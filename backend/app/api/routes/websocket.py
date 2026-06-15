import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ws_manager import ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/monitoring")
async def monitoring_websocket(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "connected",
            "data": {"message": "SteelPlant live monitoring connected"},
        })
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping", "data": {}})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
