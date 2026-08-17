import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";

export type HighlightRegion = AnatomyRegion | MuscleRegion;
export type AnatomyHighlight = "issue" | "secondary" | "target" | "rest" | "bone";

const REGION_PATTERNS: Record<HighlightRegion, RegExp> = {
  chest: /pectoralis/,
  front_shoulders: /(?:clavicular|acromial) part of deltoid/,
  rear_shoulders: /scapular spinal part of deltoid/,
  shoulders: /(?:clavicular|acromial|scapular spinal) part of deltoid/,
  upper_back: /trapezius|rhomboid|levator scapulae/,
  lats: /latissimus dorsi/,
  biceps: /biceps brachii|short head of biceps|brachialis|coracobrachialis/,
  triceps: /triceps brachii|anconeus/,
  upper_arms: /biceps brachii|short head of biceps|triceps brachii|brachialis|coracobrachialis|anconeus/,
  elbows: /anconeus/,
  forearms: /brachioradialis|pronator|supinator|flexor|extensor|palmaris/,
  wrists: /flexor carpi|extensor carpi|palmaris/,
  abs: /rectus abdominis|transversus abdominis/,
  obliques: /abdominal (external|internal) oblique/,
  torso: /rectus abdominis|transversus abdominis|abdominal (external|internal) oblique|serratus anterior/,
  lower_back: /erector spinae|multifidus|quadratus lumborum|iliocostalis|longissimus|spinalis/,
  hips: /iliopsoas|iliacus|psoas|tensor fasciae latae|sartorius|pectineus/,
  glutes: /gluteus/,
  quads: /quadriceps femoris|rectus femoris|vastus/,
  hamstrings: /biceps femoris|semimembranosus|semitendinosus/,
  adductors: /adductor (magnus|longus|brevis)|gracilis/,
  knees: /popliteus/,
  calves: /gastrocnemius|soleus|plantaris|fibularis|peroneus/,
  ankles: /tibialis|fibularis|peroneus|extensor digitorum longus|extensor hallucis longus|flexor digitorum longus|flexor hallucis longus/,
};

const SURFACE_MUSCLE_PATTERN = /(?:pectoralis major|deltoid|trapezius|latissimus dorsi|biceps brachii|triceps brachii|brachialis|coracobrachialis|anconeus|brachioradialis|pronator teres|supinator|flexor carpi|extensor carpi|flexor digitorum|extensor digitorum|palmaris longus|abductor pollicis|extensor pollicis|flexor pollicis|rectus abdominis|external abdominal oblique|serratus anterior|iliocostalis|longissimus thoracis|gluteus maximus|gluteus medius|tensor fasciae latae|sartorius|rectus femoris|vastus lateralis|vastus medialis|adductor longus|adductor magnus|gracilis|biceps femoris|semimembranosus|semitendinosus|gastrocnemius|soleus|plantaris|fibularis|tibialis anterior|extensor digitorum longus|extensor hallucis longus|sternocleidomastoid|platysma|frontalis|temporalis|superficial part of masseter|orbicularis oris|orbicularis oculi|buccinator|zygomaticus|nasalis|mentalis|depressor anguli oris|depressor labii inferioris|levator anguli oris|levator labii superioris)/;

const INTERNAL_MUSCLE_PATTERN = /(?:rectus muscle|oblique muscle|tendinous ring|tarsus|palpebrae|pterygoid|arytenoid|cricothyroid|thyro-arytenoid|pharyngeal constrictor|palatopharyngeus|stylopharyngeus|genioglossus|hyoglossus|geniohyoid|mylohyoid|digastric|diaphragm|innermost intercostal|internal intercostal|transversus thoracis|transversus abdominis|pectoralis minor|obturator|gemellus|piriformis|gluteus minimus|psoas|iliacus|quadratus femoris|multifidus|interspinales|intertransversarii|rotatores|pronator quadratus|flexor digitorum profundus|tibialis posterior)/;

export function isSurfaceAnatomyMuscle(name: string): boolean {
  return SURFACE_MUSCLE_PATTERN.test(name.toLowerCase());
}

export function isRenderableAnatomyMuscle(name: string): boolean {
  return !INTERNAL_MUSCLE_PATTERN.test(name.toLowerCase());
}

export function regionMatchesAnatomyName(region: HighlightRegion, name: string): boolean {
  return REGION_PATTERNS[region].test(name.toLowerCase());
}

function matchesAny(name: string, regions: readonly HighlightRegion[]): boolean {
  return regions.some((region) => regionMatchesAnatomyName(region, name));
}

export function anatomyHighlightForName(
  name: string,
  isMuscle: boolean,
  targetRegions: readonly MuscleRegion[],
  secondaryRegions: readonly MuscleRegion[],
  issueRegions: readonly AnatomyRegion[],
): AnatomyHighlight {
  if (!isMuscle) return "bone";
  if (matchesAny(name, issueRegions)) return "issue";
  if (matchesAny(name, secondaryRegions)) return "secondary";
  if (matchesAny(name, targetRegions)) return "target";
  return "rest";
}

export function fittedAnatomyScale(baseScale: number, zoom: number): number {
  return baseScale * zoom;
}
