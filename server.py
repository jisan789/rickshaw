import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BaperRastaMP")

# Preset Dhaka Auto hood colors: Electric Green, Classic Yellow, Neon Cyan, Hot Pink, Taxi Orange, Royal Blue
HOOD_COLORS = [
    {"name": "Electric Green", "hex": 0x24d05a, "str": "#24d05a"},
    {"name": "Rickshaw Yellow", "hex": 0xffcb1f, "str": "#ffcb1f"},
    {"name": "Neon Cyan", "hex": 0x2ee6ff, "str": "#2ee6ff"},
    {"name": "Dhaka Pink", "hex": 0xff3fa4, "str": "#ff3fa4"},
    {"name": "Traffic Orange", "hex": 0xff7b25, "str": "#ff7b25"},
    {"name": "Night Blue", "hex": 0x3d7aff, "str": "#3d7aff"},
]

class Player:
    def __init__(self, player_id: str, name: str, color_idx: int):
        self.id = player_id
        self.name = name or f"চালক #{player_id[-4:]}"
        self.color_idx = color_idx % len(HOOD_COLORS)
        self.color = HOOD_COLORS[self.color_idx]
        self.x = -9.4
        self.y = 0.0
        self.z = 110.0
        self.yaw = 0.0
        self.pitch = 0.0
        self.roll = 0.0
        self.v = 0.0
        self.steer = 0.0
        self.boost = False
        self.horn = False
        self.damage = 0
        self.alive = True
        self.last_seen = time.time()

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color["str"],
            "colorHex": self.color["hex"],
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "z": round(self.z, 2),
            "yaw": round(self.yaw, 3),
            "pitch": round(self.pitch, 3),
            "roll": round(self.roll, 3),
            "v": round(self.v, 2),
            "steer": round(self.steer, 2),
            "boost": self.boost,
            "horn": self.horn,
            "damage": self.damage,
            "alive": self.alive,
        }

class GameManager:
    def __init__(self):
        self.players: Dict[str, Player] = {}
        self.connections: Dict[str, WebSocket] = {}
        self.lock = asyncio.Lock()
        self.color_counter = 0

    async def register(self, websocket: WebSocket, name: str) -> Player:
        async with self.lock:
            player_id = str(uuid.uuid4())[:8]
            color_idx = self.color_counter
            self.color_counter = (self.color_counter + 1) % len(HOOD_COLORS)
            player = Player(player_id, name, color_idx)
            self.players[player_id] = player
            self.connections[player_id] = websocket
            logger.info(f"Driver joined: {player.name} (ID: {player_id}, Color: {player.color['name']})")
            return player

    async def unregister(self, player_id: str):
        async with self.lock:
            if player_id in self.players:
                name = self.players[player_id].name
                del self.players[player_id]
                self.connections.pop(player_id, None)
                logger.info(f"Driver left: {name} (ID: {player_id})")
                await self.broadcast_event("player_left", {"id": player_id, "name": name})

    def update_player(self, player_id: str, data: Dict[str, Any]):
        player = self.players.get(player_id)
        if not player:
            return
        player.x = float(data.get("x", player.x))
        player.y = float(data.get("y", player.y))
        player.z = float(data.get("z", player.z))
        player.yaw = float(data.get("yaw", player.yaw))
        player.pitch = float(data.get("pitch", player.pitch))
        player.roll = float(data.get("roll", player.roll))
        player.v = float(data.get("v", player.v))
        player.steer = float(data.get("steer", player.steer))
        player.boost = bool(data.get("boost", False))
        player.horn = bool(data.get("horn", False))
        player.damage = int(data.get("damage", player.damage))
        player.alive = bool(data.get("alive", True))
        player.last_seen = time.time()

    async def broadcast_event(self, event_type: str, payload: Dict[str, Any], sender_id: str = None):
        msg = json.dumps({"type": event_type, "data": payload})
        dead = []
        for pid, ws in list(self.connections.items()):
            if sender_id and pid == sender_id:
                continue
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(pid)
        for pid in dead:
            await self.unregister(pid)

    async def tick_broadcast(self):
        while True:
            try:
                await asyncio.sleep(1 / 25)  # 25 updates/sec
                if not self.players:
                    continue
                state_data = [p.to_dict() for p in self.players.values()]
                msg = json.dumps({"type": "sync", "players": state_data})
                dead = []
                for pid, ws in list(self.connections.items()):
                    try:
                        await ws.send_text(msg)
                    except Exception:
                        dead.append(pid)
                for pid in dead:
                    await self.unregister(pid)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in sync loop: {e}")

manager = GameManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    sync_task = asyncio.create_task(manager.tick_broadcast())
    logger.info("Baper Rasta multiplayer sync loop started at 25Hz.")
    yield
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass
    logger.info("Baper Rasta multiplayer sync loop stopped.")

app = FastAPI(title="বাপের রাস্তা Multiplayer Server", lifespan=lifespan)

# Health check route for Render zero-downtime deployments
@app.get("/healthz")
async def healthz():
    return {
        "status": "healthy",
        "service": "baper-rasta-multiplayer",
        "live_players": len(manager.players)
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    player = None
    try:
        # First message expected is join with name
        init_raw = await websocket.receive_text()
        init_data = json.loads(init_raw)
        name = init_data.get("name", "অটো চালক")
        player = await manager.register(websocket, name)

        # Welcome message
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "self": player.to_dict(),
            "players": [p.to_dict() for p in manager.players.values() if p.id != player.id]
        }))

        # Notify others
        await manager.broadcast_event("player_joined", player.to_dict(), sender_id=player.id)

        # Continuous message handling
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            m_type = data.get("type")

            if m_type == "state":
                manager.update_player(player.id, data)
            elif m_type == "event":
                # Horn, collision sparks, etc.
                event_name = data.get("name")
                event_data = data.get("data", {})
                event_data["sender_id"] = player.id
                await manager.broadcast_event(event_name, event_data, sender_id=player.id)

    except WebSocketDisconnect:
        if player:
            await manager.unregister(player.id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if player:
            await manager.unregister(player.id)

# Static file serving (serves index.html, game JS, CSS, audio, fonts)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
