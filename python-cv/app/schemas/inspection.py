"""
Pydantic schemas for inspection state, results, and session data.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InspectionState(str, Enum):
    WAIT_FOR_MACHINE = "wait_for_machine"
    IDENTIFY_MACHINE = "identify_machine"
    SERIAL_NUMBER = "serial_number"
    PADS_EXPIRY = "pads_expiry"
    BATTERY_CHECK = "battery_check"
    STATUS_CHECK = "status_check"
    REPORT = "report"
    COMPLETE = "complete"


class InspectionStatus(str, Enum):
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    ERROR = "error"
    PAUSED = "paused"


class StateResult(BaseModel):
    step: str
    progress: int = Field(ge=0, le=100)
    instruction: str
    completed: bool
    status: InspectionStatus = InspectionStatus.IN_PROGRESS
    data: Optional[Dict[str, Any]] = None
    guidance: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    bounding_boxes: Optional[List[Dict[str, Any]]] = None
    confidence: Optional[float] = None


@dataclass
class InspectionData:
    """Accumulated data collected during an inspection session."""
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    lot_number: Optional[str] = None
    udi: Optional[str] = None
    pads_expiry: Optional[str] = None
    pads_lot: Optional[str] = None
    battery_expiry: Optional[str] = None
    battery_lot: Optional[str] = None
    status_indicator: Optional[str] = None
    status_confidence: Optional[float] = None
    led_blink_frequency: Optional[float] = None
    inspection_result: Optional[str] = None  # PASS / FAIL / REVIEW
    completed_at: Optional[float] = None
    duration_seconds: Optional[float] = None
    notes: List[str] = field(default_factory=list)


class StartInspectionRequest(BaseModel):
    session_id: str
    inspector_id: str
    location_id: Optional[str] = None
    notes: Optional[str] = None


class InspectionReport(BaseModel):
    inspection_id: str
    session_id: str
    inspector_id: str
    started_at: float
    completed_at: Optional[float]
    duration_seconds: Optional[float]
    manufacturer: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    pads_expiry: Optional[str]
    battery_expiry: Optional[str]
    status_indicator: Optional[str]
    status_confidence: Optional[float]
    inspection_result: str  # PASS / FAIL / REVIEW
    captured_image_count: int
    location_id: Optional[str] = None
    notes: Optional[str] = None
