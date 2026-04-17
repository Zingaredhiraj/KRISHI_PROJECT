from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
import app.models as models
from app.auth import get_current_user
from app.schemas import AIChatRequest
from app.ai_service import get_ai_response

router = APIRouter(prefix="/api/ai", tags=["AI"])

@router.post("/chat")
async def ai_chat(req: AIChatRequest, current_user: models.User = Depends(get_current_user)):
    result = await get_ai_response(
        message=req.message,
        language=req.language.value if hasattr(req.language, "value") else req.language,
        user_id=current_user.id,
        image_url=req.image_url
    )
    return result

@router.get("/chat/history")
def get_chat_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return []
