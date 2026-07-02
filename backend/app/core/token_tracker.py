from app.core.logger import get_logger

logger = get_logger(__name__)

def track_llm_usage(job_id: str, response) -> None:
    """
    Parses AIMessage response metadata to extract token counts and calculate USD cost.
    Updates the SQLite database with the calculated usage.
    """
    if not job_id or not response:
        return
    try:
        metadata = getattr(response, "response_metadata", {}) or {}
        token_usage = metadata.get("token_usage")
        
        if not token_usage:
            # Check for alternative langchain metadata keys (e.g. usage_metadata)
            usage_metadata = getattr(response, "usage_metadata", {}) or {}
            if usage_metadata:
                token_usage = {
                    "prompt_tokens": usage_metadata.get("input_tokens", 0),
                    "completion_tokens": usage_metadata.get("output_tokens", 0),
                    "total_tokens": usage_metadata.get("total_tokens", 0)
                }

        if not token_usage:
            return

        prompt_tokens = token_usage.get("prompt_tokens") or token_usage.get("input_tokens") or 0
        completion_tokens = token_usage.get("completion_tokens") or token_usage.get("output_tokens") or 0
        total_tokens = token_usage.get("total_tokens") or (prompt_tokens + completion_tokens)

        # Identify model to calculate cost
        model_name = metadata.get("model_name") or ""
        if not model_name:
            model_name = getattr(response, "usage_metadata", {}).get("model", "")
            if not model_name and hasattr(response, "response_metadata"):
                model_name = response.response_metadata.get("model", "")
        
        model_name = str(model_name).lower()

        # Pricing per 1,000,000 tokens
        # Default to OpenAI GPT-4o pricing: Input $2.50, Output $10.00
        input_cost_per_m = 2.50
        output_cost_per_m = 10.00

        # Adjust pricing per model if known
        if "gpt-4o-mini" in model_name:
            input_cost_per_m = 0.15
            output_cost_per_m = 0.60
        elif "llama-3.3" in model_name:
            # Actual Groq pricing: Input $0.59, Output $0.79
            input_cost_per_m = 0.59
            output_cost_per_m = 0.79
        elif "gemini-2.5-flash" in model_name or "gemini-2.0-flash" in model_name or "gemini-1.5-flash" in model_name:
            # Actual Gemini pricing: Input $0.075, Output $0.30
            input_cost_per_m = 0.075
            output_cost_per_m = 0.30
        
        cost = (prompt_tokens * input_cost_per_m + completion_tokens * output_cost_per_m) / 1_000_000.0

        # Update database
        from app.db.writer import update_token_usage
        update_token_usage(job_id, total_tokens, cost)
        logger.info(f"Recorded tokens for job {job_id[:8]}: +{total_tokens} tokens, +${cost:.6f} USD (Model: {model_name})")

    except Exception as e:
        logger.warning(f"Failed to track token usage: {e}")
