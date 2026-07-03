import os
import json
import subprocess
import threading
from typing import Dict, Any, List
from app.core.logger import get_logger

logger = get_logger(__name__)

class MCPClient:
    def __init__(self):
        self.process = None
        self.read_thread = None
        self.pending_responses = {}
        self.lock = threading.Lock()
        self.next_id = 1
        
    def start(self):
        # Find the sf-mcp-server file path in root by traversing upwards
        current_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = ["sf-mcp-server 1.js", "sf-mcp-server.js"]
        server_path = None
        
        while True:
            for name in candidates:
                p = os.path.join(current_dir, name)
                if os.path.exists(p):
                    server_path = p
                    break
            if server_path:
                break
            parent = os.path.dirname(current_dir)
            if parent == current_dir:
                break
            current_dir = parent
                
        if not server_path:
            raise FileNotFoundError("Could not find sf-mcp-server.js in project root directory hierarchy.")
            
        logger.info(f"Starting MCP Server subprocess: node {server_path}")
        
        # Get current environment variables
        env = os.environ.copy()
        
        # Spawn stdio subprocess
        self.process = subprocess.Popen(
            ["node", server_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env
        )
        
        # Start read thread
        self.read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self.read_thread.start()
        
        # Start stderr thread
        self.error_thread = threading.Thread(target=self._error_loop, daemon=True)
        self.error_thread.start()
        
        logger.info("MCP Client initialized and listening.")
        
    def _error_loop(self):
        while self.process and self.process.poll() is None:
            try:
                line = self.process.stderr.readline()
                if not line:
                    break
                line_str = line.strip()
                if line_str:
                    logger.warning(f"[MCP Server Stderr] {line_str}")
            except Exception as e:
                logger.error(f"Error in MCP client stderr loop: {e}")
                break
        
    def _read_loop(self):
        while self.process and self.process.poll() is None:
            try:
                line = self.process.stdout.readline()
                if not line:
                    break
                line_str = line.strip()
                if not line_str:
                    continue
                    
                try:
                    msg = json.loads(line_str)
                    if "id" in msg:
                        call_id = msg["id"]
                        with self.lock:
                            if call_id in self.pending_responses:
                                self.pending_responses[call_id] = msg
                except json.JSONDecodeError:
                    # Ignore non-JSON info lines if any
                    pass
            except Exception as e:
                logger.error(f"Error in MCP client read loop: {e}")
                break
                
    def call_tool(self, name: str, arguments: Dict[str, Any], timeout: float = 15.0) -> Dict[str, Any]:
        if not self.process or self.process.poll() is not None:
            self.start()
            
        call_id = self.next_id
        self.next_id += 1
        
        req = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            },
            "id": call_id
        }
        
        with self.lock:
            self.pending_responses[call_id] = None
            
        logger.info(f"MCP Client sending tool call request [{call_id}]: {name}")
        
        try:
            self.process.stdin.write(json.dumps(req) + "\n")
            self.process.stdin.flush()
        except Exception as e:
            logger.error(f"Failed to write to MCP stdin: {e}")
            raise RuntimeError(f"MCP Server connection lost: {e}")
            
        # Wait for response with timeout
        import time
        start_time = time.time()
        while time.time() - start_time < timeout:
            with self.lock:
                res = self.pending_responses.get(call_id)
                if res is not None:
                    del self.pending_responses[call_id]
                    return res
            time.sleep(0.05)
            
        with self.lock:
            if call_id in self.pending_responses:
                del self.pending_responses[call_id]
                
        raise TimeoutError(f"MCP tool call '{name}' timed out after {timeout} seconds.")
        
    def list_tools(self, timeout: float = 5.0) -> List[Dict[str, Any]]:
        if not self.process or self.process.poll() is not None:
            self.start()
            
        call_id = self.next_id
        self.next_id += 1
        
        req = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": call_id
        }
        
        with self.lock:
            self.pending_responses[call_id] = None
            
        try:
            self.process.stdin.write(json.dumps(req) + "\n")
            self.process.stdin.flush()
        except Exception as e:
            raise RuntimeError(f"MCP Server connection lost: {e}")
            
        import time
        start_time = time.time()
        while time.time() - start_time < timeout:
            with self.lock:
                res = self.pending_responses.get(call_id)
                if res is not None:
                    del self.pending_responses[call_id]
                    return res.get("result", {}).get("tools", [])
            time.sleep(0.05)
            
        with self.lock:
            if call_id in self.pending_responses:
                del self.pending_responses[call_id]
        raise TimeoutError("MCP list_tools timed out.")
        
    def stop(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=2.0)
            except Exception:
                pass
            self.process = None
