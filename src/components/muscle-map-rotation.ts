const HALF_TURN = Math.PI;
const FULL_TURN = Math.PI * 2;

function canonicalFace(rotation: number, direction: number): number {
  "worklet";
  const wrapped = ((rotation % FULL_TURN) + FULL_TURN) % FULL_TURN;
  if (Math.abs(wrapped) < 0.0001 || Math.abs(wrapped - FULL_TURN) < 0.0001) return 0;
  if (Math.abs(wrapped - HALF_TURN) < 0.0001) return direction < 0 ? -HALF_TURN : HALF_TURN;
  return wrapped > HALF_TURN ? wrapped - FULL_TURN : wrapped;
}

export function snappedMuscleMapRotation(currentRotation: number, translationX: number, velocityX: number, width: number): number {
  "worklet";
  const safeWidth = Math.max(width, 1);
  const currentFace = Math.round(currentRotation / HALF_TURN) * HALF_TURN;
  const deliberateDrag = Math.abs(translationX) >= safeWidth * 0.28;
  const fastFlick = Math.abs(velocityX) >= 700;
  if (!deliberateDrag && !fastFlick) return canonicalFace(currentFace, translationX || velocityX);
  const direction = Math.sign(Math.abs(translationX) > 6 ? translationX : velocityX);
  return canonicalFace(currentFace + direction * HALF_TURN, direction);
}
