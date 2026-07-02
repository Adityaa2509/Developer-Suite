from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import get_settings

def get_embeddings():
    settings = get_settings()

    return GoogleGenerativeAIEmbeddings(
        model=settings.EMBEDDING_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
    )