import os
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
import app.models as models
from app.auth import get_current_user

logger = logging.getLogger("digital_krishi.misc")

router = APIRouter(prefix="/api", tags=["Misc"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_UPLOAD_EXT = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


# ── File Upload ───────────────────────────────────────────────
@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    original = (file.filename or "image.jpg").rsplit(".", 1)
    ext = original[-1].lower() if len(original) == 2 else "jpg"
    if ext not in ALLOWED_UPLOAD_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only jpg, jpeg, png, webp, or gif images are allowed.",
        )

    new_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)
    written = 0
    with open(file_path, "wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 64)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                buffer.close()
                os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="File is larger than 5 MB.",
                )
            buffer.write(chunk)

    logger.info("User %s uploaded %s (%s bytes)", current_user.id, new_filename, written)
    return {
        "url": f"/uploads/{new_filename}",
        "filename": new_filename,
        "size": written,
    }


# ── Notifications ─────────────────────────────────────────────
@router.get("/notifications")
def get_notifications(
    unread_only: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(models.Notification.is_read == False)
    notifications = query.order_by(models.Notification.created_at.desc()).limit(50).all()
    return notifications


@router.put("/notifications/{notification_id}")
def mark_notification_read(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "Notification marked as read"}


@router.post("/notifications/mark-all-read")
def mark_all_notifications_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


# ── Documents ─────────────────────────────────────────────────
@router.get("/documents")
def get_documents(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(models.UserDocument).filter(
        models.UserDocument.user_id == current_user.id
    ).order_by(models.UserDocument.created_at.desc()).all()
    return docs


@router.post("/documents")
def upload_document(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return {"id": 1, "message": "Document uploaded successfully"}


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(models.UserDocument).filter(
        models.UserDocument.id == doc_id,
        models.UserDocument.user_id == current_user.id
    ).first()
    if doc:
        db.delete(doc)
        db.commit()
    return {"message": "Document deleted"}


# ── Consultations ─────────────────────────────────────────────
@router.get("/consultations")
def get_consultations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    consultations = db.query(models.ExpertConsultation).filter(
        models.ExpertConsultation.user_id == current_user.id
    ).order_by(models.ExpertConsultation.created_at.desc()).all()
    return consultations


@router.post("/consultations")
def create_consultation(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return {"id": 1, "message": "Consultation request submitted", "status": "pending"}
