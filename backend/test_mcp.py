import sys
import os

# Add backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.salesforce.mcp_client import MCPClient

def main():
    print("Testing connection to Node.js MCP Server & Salesforce org...")
    client = MCPClient()
    try:
        client.start()
        print("Spawning subprocess...")
        tools = client.list_tools()
        print(f"\n✅ SUCCESS! MCP Server is fully operational.")
        print(f"Exposing {len(tools)} tools connected to your Salesforce org:\n")
        for idx, t in enumerate(tools, 1):
            print(f" {idx}. {t['name']} - {t['description'][:75]}...")
    except Exception as e:
        print(f"\n❌ CONNECTION ERROR: {e}")
        print("\nTroubleshooting Checks:")
        print("1. Verify your Salesforce environment variables in your backend settings (.env) are populated.")
        print("2. Ensure node is installed and sf-mcp-server 1.js exists in the project root.")
    finally:
        client.stop()

if __name__ == "__main__":
    main()
