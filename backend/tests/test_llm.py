from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from app.core.llm import get_llm_with_fallbacks
from app.core.config import get_settings


def test_llm_chain_initialises():
    llm = get_llm_with_fallbacks()
    assert llm is not None
    print("\n✅ LLM chain initialised")


def test_llm_chain_responds():
    llm = get_llm_with_fallbacks()
    r = llm.invoke([HumanMessage(content="Reply with the word READY only.")])
    assert r.content is not None
    assert len(r.content) > 0
    print(f"\n✅ LLM chain response: {r.content}")


def test_gemini_primary_responds():
    s = get_settings()
    m = ChatGoogleGenerativeAI(
        model=s.GEMINI_MODEL_PRIMARY,
        google_api_key=s.GEMINI_API_KEY,
        convert_system_message_to_human=True,
    )
    r = m.invoke([HumanMessage(content="Say OK")])
    assert r.content
    print(f"\n✅ Gemini 2.0 Flash: {r.content[:30]}")


def test_gemini_fallback_responds():
    s = get_settings()
    m = ChatGoogleGenerativeAI(
        model=s.GEMINI_MODEL_FALLBACK,
        google_api_key=s.GEMINI_API_KEY,
        convert_system_message_to_human=True,
    )
    r = m.invoke([HumanMessage(content="Say OK")])
    assert r.content
    print(f"\n✅ Gemini 1.5 Flash: {r.content[:30]}")


def test_groq_fallback_responds():
    s = get_settings()
    m = ChatGroq(model=s.GROQ_MODEL, api_key=s.GROQ_API_KEY)
    r = m.invoke([HumanMessage(content="Say OK")])
    assert r.content
    print(f"\n✅ Groq Llama 3.3: {r.content[:30]}")
