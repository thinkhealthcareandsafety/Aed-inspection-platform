"""Inspection REST endpoints for session management."""
from fastapi import APIRouter
from app.api.websockets.inspection_ws import _active_sessions

router = APIRouter()


@router.get("/sessions")
async def list_sessions():
    return {
        "active_sessions": list(_active_sessions.keys()),
        "count": len(_active_sessions),
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    machine = _active_sessions.get(session_id)
    if not machine:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    s = machine.session
    return {
        "session_id": s.session_id,
        "current_state": s.current_state.value,
        "progress": s.progress,
        "manufacturer": s.manufacturer,
        "model": s.model,
        "data": s.data.__dict__,
    }
