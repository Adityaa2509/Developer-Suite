"""
llm.py
──────
LLM factory with fallbacks and retry logic.

UPDATED for Day 5:
  Primary:    Groq Llama 3.3 70B (faster, generous free tier, good tool calling)
  Fallback 1: Gemini 2.0 Flash (original primary — still excellent)
  Fallback 2: Gemini 1.5 Flash (reliable backup)

Why Groq as primary now?
  - Groq free tier: much higher RPM than Gemini
  - Speed: responses in < 1 second (Groq uses custom hardware)
  - Tool calling: Llama 3.3 70B handles tool calling well
  - Result: investigations run 2-3x faster

Retry logic: on rate limit (429) or timeout, backs off and retries.
"""

import time
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.language_models import BaseChatModel
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)


def get_llm_with_fallbacks(tools: list | None = None) -> BaseChatModel:
    """
    Returns LLM with fallback chain and retry logic.
    Groq (Key 1) → Groq (Key 2) → Gemini Primary (Key 1) → Gemini Primary (Key 2) → Gemini Fallback
    """
    s = get_settings()

    primary = ChatGroq(
        model=s.GROQ_MODEL,
        api_key=s.GROQ_API_KEY,
        temperature=0.1,
        max_retries=3,
    )

    fallbacks = []

    # 1. Fallback to second Groq key if available
    if s.GROQ_API_KEY_FALLBACK:
        fallbacks.append(ChatGroq(
            model=s.GROQ_MODEL,
            api_key=s.GROQ_API_KEY_FALLBACK,
            temperature=0.1,
            max_retries=3,
        ))

    # 2. Fallback to Gemini Primary Model with primary key
    fallbacks.append(ChatGoogleGenerativeAI(
        model=s.GEMINI_MODEL_PRIMARY,
        google_api_key=s.GEMINI_API_KEY,
        temperature=0.1,
        convert_system_message_to_human=True,
        max_retries=2,
    ))

    # 3. Fallback to Gemini Primary Model with fallback key if available
    if s.GEMINI_API_KEY_FALLBACK:
        fallbacks.append(ChatGoogleGenerativeAI(
            model=s.GEMINI_MODEL_PRIMARY,
            google_api_key=s.GEMINI_API_KEY_FALLBACK,
            temperature=0.1,
            convert_system_message_to_human=True,
            max_retries=2,
        ))

    # 4. Fallback to Gemini Fallback Model with primary key
    fallbacks.append(ChatGoogleGenerativeAI(
        model=s.GEMINI_MODEL_FALLBACK,
        google_api_key=s.GEMINI_API_KEY,
        temperature=0.1,
        convert_system_message_to_human=True,
        max_retries=2,
    ))

    if tools:
        primary = primary.bind_tools(tools)
        fallbacks = [m.bind_tools(tools) for m in fallbacks]

    logger.info(
        f"LLM chain: {s.GROQ_MODEL} (primary) "
        + ("→ GROQ_FALLBACK " if s.GROQ_API_KEY_FALLBACK else "")
        + f"→ {s.GEMINI_MODEL_PRIMARY} (Gemini Primary)"
        + (" → Gemini Primary AltKey" if s.GEMINI_API_KEY_FALLBACK else "")
        + f" → {s.GEMINI_MODEL_FALLBACK} (Gemini Fallback)"
    )

    return primary.with_fallbacks(
        fallbacks,
        exceptions_to_handle=(Exception,),
    )


def get_reporter_llm() -> BaseChatModel:
    """
    Reporter LLM with fallbacks.
    Reporter generates JSON RCA output.
    """
    s = get_settings()

    primary = ChatGroq(
        model=s.GROQ_MODEL,
        api_key=s.GROQ_API_KEY,
        temperature=0.0,
        max_retries=3,
    )

    fallbacks = []

    # 1. Fallback to second Groq key if available
    if s.GROQ_API_KEY_FALLBACK:
        fallbacks.append(ChatGroq(
            model=s.GROQ_MODEL,
            api_key=s.GROQ_API_KEY_FALLBACK,
            temperature=0.0,
            max_retries=3,
        ))

    # 2. Fallback to Gemini Primary Model with primary key
    fallbacks.append(ChatGoogleGenerativeAI(
        model=s.GEMINI_MODEL_PRIMARY,
        google_api_key=s.GEMINI_API_KEY,
        temperature=0.0,
        convert_system_message_to_human=True,
        max_retries=2,
    ))

    # 3. Fallback to Gemini Primary Model with fallback key if available
    if s.GEMINI_API_KEY_FALLBACK:
        fallbacks.append(ChatGoogleGenerativeAI(
            model=s.GEMINI_MODEL_PRIMARY,
            google_api_key=s.GEMINI_API_KEY_FALLBACK,
            temperature=0.0,
            convert_system_message_to_human=True,
            max_retries=2,
        ))

    # 4. Fallback to Gemini Fallback Model with primary key
    fallbacks.append(ChatGoogleGenerativeAI(
        model=s.GEMINI_MODEL_FALLBACK,
        google_api_key=s.GEMINI_API_KEY,
        temperature=0.0,
        convert_system_message_to_human=True,
        max_retries=2,
    ))

    logger.info(
        f"Reporter chain: {s.GROQ_MODEL} "
        + ("→ GROQ_FALLBACK " if s.GROQ_API_KEY_FALLBACK else "")
        + f"→ {s.GEMINI_MODEL_PRIMARY} (Gemini Primary)"
        + (" → Gemini Primary AltKey" if s.GEMINI_API_KEY_FALLBACK else "")
        + f" → {s.GEMINI_MODEL_FALLBACK} (Gemini Fallback)"
    )

    return primary.with_fallbacks(
        fallbacks,
        exceptions_to_handle=(Exception,),
    )

