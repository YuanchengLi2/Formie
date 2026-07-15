import type {
  CameraView,
  Exercise,
  ExerciseCategory,
  ExerciseFaultContext,
} from "./types";

const ANALYSIS_INSTRUCTION =
  "Use these checks as attention guidance, not an exhaustive list. Analyze the complete video and report any visible, evidence-backed technique issue, including a novel issue not listed here.";

const UPPER_BODY = ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip"];
const LOWER_BODY = ["left_shoulder", "right_shoulder", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"];
const FULL_BODY = [...UPPER_BODY, "left_knee", "right_knee", "left_ankle", "right_ankle"];

const PRESS_PHASES = ["setup", "eccentric lowering", "bottom transition", "concentric press", "lockout"];
const PULL_PHASES = ["setup", "eccentric reach", "concentric pull", "peak contraction", "controlled return"];
const SQUAT_PHASES = ["setup", "descent", "bottom position", "ascent", "lockout"];
const HINGE_PHASES = ["setup", "eccentric hinge", "bottom position", "concentric extension", "lockout"];
const SINGLE_JOINT_PHASES = ["setup", "eccentric phase", "transition", "concentric phase", "controlled return"];
const ISOMETRIC_PHASES = ["setup", "stable hold", "release"];

type FaultSeed = readonly [observation: string, whyItMatters: string, cue: string];

type ExerciseSeed = {
  slug: string;
  name: string;
  category: ExerciseCategory;
  equipment: string[];
  aliases: string[];
  view: CameraView;
  alternatives?: CameraView[];
  landmarks: string[];
  phases: string[];
  attention: string[];
  faults: FaultSeed[];
};

function fault([observation, whyItMatters, cue]: FaultSeed): ExerciseFaultContext {
  return { observation, whyItMatters, cue };
}

function seed(
  slug: string,
  name: string,
  category: ExerciseCategory,
  equipment: string[],
  aliases: string[],
  view: CameraView,
  landmarks: string[],
  phases: string[],
  attention: string[],
  faults: FaultSeed[],
  alternatives: CameraView[] = [],
): ExerciseSeed {
  return { slug, name, category, equipment, aliases, view, alternatives, landmarks, phases, attention, faults };
}

const SEEDS: ExerciseSeed[] = [
  seed("barbell-bench-press", "Barbell Bench Press", "Chest", ["barbell", "bench"], ["bench press", "flat bench"], "side", UPPER_BODY, PRESS_PHASES, ["wrist-elbow stacking", "bar path", "shoulder and torso stability", "balanced lockout"], [["Elbows flare abruptly away from the torso during the press", "It can reduce control of the bar path", "Keep your forearms vertical and press back toward the rack"], ["The bar touches too high on the chest", "It can shift the forearms out of a strong stacked position", "Lower toward the lower chest while keeping wrists over elbows"]], ["front-45"]),
  seed("incline-dumbbell-press", "Incline Dumbbell Press", "Chest", ["dumbbells", "incline bench"], ["incline db press"], "front-45", UPPER_BODY, PRESS_PHASES, ["left-right symmetry", "forearm angle", "shoulder position", "dumbbell path"], [["One dumbbell rises ahead of the other", "The sides are not sharing the repetition evenly", "Press both bells together and finish at the same height"]], ["side"]),
  seed("dumbbell-bench-press", "Dumbbell Bench Press", "Chest", ["dumbbells", "bench"], ["flat dumbbell press", "db bench"], "front-45", UPPER_BODY, PRESS_PHASES, ["left-right symmetry", "elbow path", "wrist position", "depth control"], [["The wrists bend back under the dumbbells", "A stacked wrist gives a more stable pressing line", "Keep your knuckles pointed toward the ceiling"]], ["side"]),
  seed("incline-barbell-bench-press", "Incline Barbell Bench Press", "Chest", ["barbell", "incline bench"], ["incline bench"], "side", UPPER_BODY, PRESS_PHASES, ["bar path", "wrist-elbow stacking", "touch point", "lockout symmetry"], [["The bar drifts toward the abdomen during the press", "The path moves away from the shoulder line", "Press up and slightly back over the shoulders"]], ["front-45"]),
  seed("push-up", "Push-Up", "Chest", ["bodyweight"], ["pushup", "press up"], "side", FULL_BODY, PRESS_PHASES, ["head-to-heel alignment", "elbow path", "depth", "scapular movement"], [["The hips sag below the shoulder-to-ankle line", "It reduces whole-body tension during the repetition", "Brace as if holding a plank from head to heels"]]),
  seed("machine-chest-press", "Machine Chest Press", "Chest", ["chest press machine"], ["seated chest press"], "side", UPPER_BODY, PRESS_PHASES, ["seat alignment", "wrist-elbow stacking", "shoulder contact", "controlled return"], [["The shoulders roll forward at the end of the press", "The torso loses its stable contact with the pad", "Keep your upper back set and stop before the shoulders peel forward"]], ["front-45"]),
  seed("cable-fly", "Cable Fly", "Chest", ["cable machine"], ["cable crossover", "standing fly"], "front-45", UPPER_BODY, SINGLE_JOINT_PHASES, ["elbow bend consistency", "hand path", "torso stillness", "left-right symmetry"], [["The elbows repeatedly bend and straighten through the rep", "The movement changes from a fly toward a press", "Hold a soft fixed elbow bend and sweep your arms together"]]),

  seed("conventional-deadlift", "Conventional Deadlift", "Back", ["barbell"], ["deadlift"], "side", FULL_BODY, HINGE_PHASES, ["bar-to-body distance", "hip and shoulder timing", "spinal shape", "balanced lockout"], [["The bar drifts forward away from the legs", "A forward bar path makes the lift less vertically efficient", "Keep the bar close and push the floor away"]], ["front-45"]),
  seed("lat-pulldown", "Lat Pulldown", "Back", ["lat pulldown machine"], ["pulldown"], "front", UPPER_BODY, PULL_PHASES, ["bar symmetry", "elbow path", "torso motion", "controlled overhead reach"], [["The torso swings backward to start the pull", "Momentum replaces a controlled vertical pull", "Stay tall and drive your elbows down"]], ["front-45"]),
  seed("pull-up", "Pull-Up", "Back", ["pull-up bar"], ["chin up", "pullup"], "front", FULL_BODY, PULL_PHASES, ["body swing", "left-right symmetry", "chin clearance", "controlled descent"], [["The legs swing to create upward momentum", "Momentum obscures upper-body control", "Begin from a quiet hang and keep your ribs stacked"]], ["front-45"]),
  seed("seated-cable-row", "Seated Cable Row", "Back", ["cable row"], ["cable row", "seated row"], "side", UPPER_BODY, PULL_PHASES, ["torso stability", "elbow path", "shoulder reach", "handle path"], [["The torso rocks far backward during the pull", "Torso momentum reduces the consistency of the row", "Keep your torso quiet and pull the handle toward your ribs"]], ["front-45"]),
  seed("one-arm-dumbbell-row", "One-Arm Dumbbell Row", "Back", ["dumbbell", "bench"], ["single arm row", "db row"], "side", UPPER_BODY, PULL_PHASES, ["torso rotation", "elbow path", "shoulder reach", "dumbbell path"], [["The torso opens toward the ceiling at the top", "Rotation can replace the intended shoulder and elbow motion", "Keep both shoulders square to the floor"]], ["rear-45"]),
  seed("barbell-bent-over-row", "Barbell Bent-Over Row", "Back", ["barbell"], ["barbell row", "bent row"], "side", FULL_BODY, PULL_PHASES, ["hinge angle consistency", "bar path", "elbow symmetry", "torso movement"], [["The torso rises with each pull", "Changing torso angle turns the row into a momentum-driven movement", "Lock in your hinge and row the bar to the same point"]], ["front-45"]),
  seed("chest-supported-row", "Chest-Supported Row", "Back", ["dumbbells", "incline bench"], ["incline row"], "rear-45", UPPER_BODY, PULL_PHASES, ["chest contact", "elbow path", "left-right symmetry", "shoulder movement"], [["The chest lifts away from the pad at the top", "The support no longer limits torso momentum", "Keep your sternum connected to the pad"]], ["side"]),
  seed("face-pull", "Face Pull", "Back", ["cable machine", "rope"], ["rope face pull"], "front", UPPER_BODY, PULL_PHASES, ["hand-elbow relationship", "left-right symmetry", "torso stillness", "rope endpoint"], [["The hands finish well below the elbows", "The pull changes away from the intended high-elbow path", "Pull the rope toward eye level with elbows wide"]], ["front-45"]),

  seed("romanian-deadlift", "Romanian Deadlift", "Legs", ["barbell"], ["rdl", "stiff leg deadlift"], "side", FULL_BODY, HINGE_PHASES, ["hip travel", "knee bend consistency", "bar-to-leg distance", "spinal shape"], [["The knees keep bending as the bar lowers", "The pattern shifts from a hinge toward a squat", "Send your hips back while keeping a soft, steady knee bend"]]),
  seed("back-squat", "Back Squat", "Legs", ["barbell", "rack"], ["barbell squat", "squat"], "side", FULL_BODY, SQUAT_PHASES, ["depth", "foot balance", "knee and hip timing", "bar path"], [["The heels lift near the bottom", "The base of support shifts forward", "Keep pressure through the whole foot as you descend"]], ["rear-45"]),
  seed("front-squat", "Front Squat", "Legs", ["barbell", "rack"], ["front bar squat"], "side", FULL_BODY, SQUAT_PHASES, ["torso angle", "elbow height", "depth", "foot balance"], [["The elbows drop as the lifter reaches the bottom", "The upper-body rack position becomes less stable", "Drive your elbows forward and keep your chest tall"]], ["front-45"]),
  seed("goblet-squat", "Goblet Squat", "Legs", ["dumbbell"], ["kettlebell squat", "db squat"], "front-45", FULL_BODY, SQUAT_PHASES, ["depth", "knee tracking", "torso control", "foot balance"], [["The knees collapse inward during the ascent", "The knee path becomes less consistent over the feet", "Keep your knees tracking in line with your toes"]], ["side"]),
  seed("leg-press", "Leg Press", "Legs", ["leg press machine"], ["sled press"], "side", LOWER_BODY, PRESS_PHASES, ["pelvis contact", "knee tracking", "depth", "lockout control"], [["The pelvis rolls away from the pad at the bottom", "The available range has exceeded the stable seated position", "Stop the descent before your hips tuck off the pad"]]),
  seed("bulgarian-split-squat", "Bulgarian Split Squat", "Legs", ["bench", "dumbbells"], ["rear foot elevated split squat", "bss"], "side", FULL_BODY, SQUAT_PHASES, ["front-foot balance", "knee path", "pelvis stability", "depth"], [["The front heel lifts during the descent", "The base of support shifts toward the toes", "Keep your full front foot planted and sit straight down"]], ["front-45"]),
  seed("walking-lunge", "Walking Lunge", "Legs", ["bodyweight"], ["forward lunge"], "side", FULL_BODY, ["step", "descent", "bottom position", "ascent", "transfer"], ["step length", "front-foot balance", "knee tracking", "pelvis control"], [["The front knee moves sharply inward during the push-off", "The leg loses a consistent line over the foot", "Push through the whole foot with the knee following the toes"]], ["front-45"]),
  seed("reverse-lunge", "Reverse Lunge", "Legs", ["bodyweight"], ["backward lunge"], "side", FULL_BODY, ["step back", "descent", "bottom position", "ascent", "return"], ["front-foot balance", "step distance", "torso control", "knee tracking"], [["The rear step is too short to lower cleanly", "A cramped stance can force balance corrections", "Reach the rear foot back far enough to drop both knees comfortably"]], ["front-45"]),
  seed("leg-extension", "Leg Extension", "Legs", ["leg extension machine"], ["knee extension"], "side", LOWER_BODY, SINGLE_JOINT_PHASES, ["seat and knee alignment", "controlled extension", "pelvis contact", "left-right symmetry"], [["The hips lift from the seat near full extension", "The body is adding motion outside the intended knee movement", "Keep your hips heavy in the pad and use a controlled range"]]),
  seed("seated-leg-curl", "Seated Leg Curl", "Legs", ["leg curl machine"], ["hamstring curl"], "side", LOWER_BODY, SINGLE_JOINT_PHASES, ["machine-axis alignment", "pelvis contact", "controlled return", "left-right symmetry"], [["The hips lift as the heels pull down", "Pelvis movement reduces isolation of the knee motion", "Keep your hips pinned and curl smoothly"]]),
  seed("hip-thrust", "Hip Thrust", "Legs", ["barbell", "bench"], ["barbell hip thrust", "glute bridge"], "side", FULL_BODY, ["setup", "descent", "bottom position", "hip extension", "top control"], ["rib-pelvis relationship", "shin angle", "head and torso path", "top position"], [["The lower back continues extending after the hips reach the top", "Extra torso extension replaces a controlled hip finish", "Finish with ribs down and hips level"]]),
  seed("standing-calf-raise", "Standing Calf Raise", "Legs", ["calf raise machine"], ["calf raise"], "side", LOWER_BODY, SINGLE_JOINT_PHASES, ["ankle range", "knee consistency", "tempo", "balance"], [["The knees repeatedly bend to bounce upward", "Momentum replaces controlled ankle motion", "Keep your knees quiet and rise through the balls of your feet"]]),

  seed("barbell-overhead-press", "Barbell Overhead Press", "Shoulders", ["barbell"], ["ohp", "military press"], "side", FULL_BODY, PRESS_PHASES, ["bar path", "wrist-elbow stacking", "rib and pelvis control", "balanced lockout"], [["The torso leans farther back as the bar passes the face", "The bar path is being created by trunk movement", "Brace your ribs down and move your head through after the bar passes"]], ["front-45"]),
  seed("dumbbell-shoulder-press", "Dumbbell Shoulder Press", "Shoulders", ["dumbbells", "bench"], ["seated db press"], "front", UPPER_BODY, PRESS_PHASES, ["left-right symmetry", "forearm angle", "shoulder position", "lockout"], [["One arm finishes lower than the other", "The repetition is not completing symmetrically", "Press both dumbbells to the same height without rushing the stronger side"]], ["front-45"]),
  seed("dumbbell-lateral-raise", "Dumbbell Lateral Raise", "Shoulders", ["dumbbells"], ["side raise", "lateral raise"], "front", FULL_BODY, SINGLE_JOINT_PHASES, ["torso stillness", "left-right symmetry", "elbow-wrist path", "top height"], [["The torso rocks to launch the dumbbells", "Momentum reduces control of the arm path", "Stay tall and raise the elbows smoothly"]], ["front-45"]),
  seed("dumbbell-front-raise", "Dumbbell Front Raise", "Shoulders", ["dumbbells"], ["front raise"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["torso stillness", "arm path", "elbow consistency", "controlled return"], [["The hips drive forward to start each raise", "Body momentum replaces controlled shoulder motion", "Keep your hips stacked and lift without leaning back"]], ["front-45"]),
  seed("rear-delt-fly", "Rear-Delt Fly", "Shoulders", ["dumbbells"], ["reverse fly", "rear fly"], "rear-45", UPPER_BODY, SINGLE_JOINT_PHASES, ["hinge consistency", "elbow angle", "left-right symmetry", "arm path"], [["The torso rises as the arms open", "Changing the hinge adds momentum to the repetition", "Hold your torso angle and sweep the arms apart"]], ["side"]),
  seed("upright-row", "Upright Row", "Shoulders", ["barbell"], ["high pull row"], "front", UPPER_BODY, PULL_PHASES, ["left-right symmetry", "wrist-elbow relationship", "bar-to-body distance", "torso stillness"], [["The bar travels far away from the torso", "A distant path reduces control of the vertical pull", "Guide the bar close while leading with the elbows"]], ["front-45"]),
  seed("dumbbell-shrug", "Dumbbell Shrug", "Shoulders", ["dumbbells"], ["shrug"], "front", UPPER_BODY, SINGLE_JOINT_PHASES, ["vertical shoulder path", "head position", "left-right symmetry", "torso stillness"], [["The shoulders roll in large circles", "The intended motion is a controlled elevation and return", "Lift your shoulders straight up, pause, and lower"]], ["front-45"]),

  seed("standing-dumbbell-curl", "Standing Dumbbell Curl", "Arms", ["dumbbells"], ["db curl", "bicep curl"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["elbow drift", "wrist position", "torso stillness", "controlled lowering"], [["The elbows travel forward during the concentric phase", "Shoulder motion is replacing part of the elbow curl", "Keep your elbows pinned near your sides"]], ["front-45"]),
  seed("hammer-curl", "Hammer Curl", "Arms", ["dumbbells"], ["neutral grip curl"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["neutral wrist", "elbow drift", "left-right symmetry", "torso stillness"], [["The wrists bend as the dumbbells approach the top", "The neutral forearm position becomes less stable", "Keep your thumbs up and wrists straight"]], ["front-45"]),
  seed("barbell-curl", "Barbell Curl", "Arms", ["barbell"], ["straight bar curl", "ez bar curl"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["elbow drift", "torso swing", "wrist position", "controlled lowering"], [["The hips drive forward to start the bar", "Momentum replaces the beginning of the curl", "Stay tall and begin each rep from quiet hips"]], ["front-45"]),
  seed("cable-curl", "Cable Curl", "Arms", ["cable machine"], ["low cable curl"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["elbow position", "cable alignment", "torso stillness", "full controlled return"], [["The shoulders move forward as the handle rises", "Upper-arm movement replaces part of the elbow action", "Keep your upper arms quiet and curl through the elbows"]], ["front-45"]),
  seed("preacher-curl", "Preacher Curl", "Arms", ["preacher bench", "curl bar"], ["preacher bench curl"], "side", UPPER_BODY, SINGLE_JOINT_PHASES, ["upper-arm pad contact", "wrist position", "controlled bottom", "left-right symmetry"], [["The upper arms lift away from the pad near the top", "The support no longer fixes the upper-arm position", "Keep your arms heavy on the pad throughout the curl"]]),
  seed("cable-triceps-pushdown", "Cable Triceps Pushdown", "Arms", ["cable machine"], ["tricep pushdown", "rope pushdown"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["elbow position", "torso stillness", "wrist finish", "controlled return"], [["The elbows move forward and backward through each rep", "Shoulder motion replaces part of the elbow extension", "Pin your elbows by your ribs and move only the forearms"]], ["front-45"]),
  seed("overhead-triceps-extension", "Overhead Triceps Extension", "Arms", ["dumbbell"], ["overhead extension"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["elbow position", "rib control", "wrist alignment", "depth"], [["The ribs flare as the weight lowers", "Torso extension is adding range outside the elbows", "Brace your ribs and keep the elbows pointing forward"]], ["front-45"]),
  seed("skull-crusher", "Skull Crusher", "Arms", ["curl bar", "bench"], ["lying triceps extension"], "side", UPPER_BODY, SINGLE_JOINT_PHASES, ["upper-arm angle", "elbow symmetry", "wrist position", "bar path"], [["The upper arms swing toward the feet during extension", "Shoulder motion replaces part of the elbow extension", "Keep the upper arms angled consistently while straightening the elbows"]], ["front-45"]),
  seed("parallel-bar-dip", "Parallel-Bar Dip", "Arms", ["dip bars"], ["dip", "triceps dip"], "side", FULL_BODY, PRESS_PHASES, ["shoulder depth", "elbow path", "body swing", "lockout control"], [["The body swings between repetitions", "Momentum reduces control of the pressing path", "Pause in a quiet support before beginning the next rep"]], ["front-45"]),
  seed("close-grip-bench-press", "Close-Grip Bench Press", "Arms", ["barbell", "bench"], ["close grip bench", "cgbp"], "side", UPPER_BODY, PRESS_PHASES, ["wrist-elbow stacking", "elbow path", "bar path", "balanced lockout"], [["The wrists sit far inside the elbows", "The grip is too narrow for a stable forearm stack", "Set your hands so the wrists stay over the elbows"]], ["front-45"]),

  seed("front-plank", "Front Plank", "Core", ["bodyweight"], ["plank"], "side", FULL_BODY, ISOMETRIC_PHASES, ["head-to-heel line", "pelvis height", "shoulder position", "hold consistency"], [["The hips gradually sag during the hold", "The head-to-heel line loses consistency", "Squeeze your glutes and keep your belt line level"]]),
  seed("side-plank", "Side Plank", "Core", ["bodyweight"], ["lateral plank"], "front", FULL_BODY, ISOMETRIC_PHASES, ["shoulder stacking", "hip height", "head-to-foot line", "rotation control"], [["The hips rotate toward the floor", "The torso is no longer stacked in the side position", "Keep your shoulders and hips facing the same direction"]], ["front-45"]),
  seed("crunch", "Crunch", "Core", ["bodyweight"], ["ab crunch"], "side", UPPER_BODY, SINGLE_JOINT_PHASES, ["rib-to-pelvis motion", "neck position", "controlled return", "hip stability"], [["The head leads the movement while the ribs stay still", "Neck motion is replacing visible trunk flexion", "Keep space under your chin and curl your ribs toward your pelvis"]]),
  seed("hanging-leg-raise", "Hanging Leg Raise", "Core", ["pull-up bar"], ["hanging knee raise"], "side", FULL_BODY, ["quiet hang", "leg raise", "top position", "controlled lowering", "reset"], ["body swing", "pelvic motion", "knee angle consistency", "controlled lowering"], [["The legs swing behind the body before each raise", "Momentum replaces a controlled start", "Return to a quiet hang before raising the legs"]], ["front-45"]),
  seed("cable-crunch", "Cable Crunch", "Core", ["cable machine", "rope"], ["kneeling cable crunch"], "side", FULL_BODY, SINGLE_JOINT_PHASES, ["rib-to-pelvis motion", "hip position", "rope path", "controlled return"], [["The hips rock backward and forward through the rep", "Hip motion replaces part of the visible trunk curl", "Keep your hips quiet and bring your ribs toward your pelvis"]]),
  seed("ab-wheel-rollout", "Ab Wheel Rollout", "Core", ["ab wheel"], ["wheel rollout"], "side", FULL_BODY, ["setup", "rollout", "extended position", "return", "reset"], ["rib-pelvis control", "hip-shoulder timing", "wheel path", "return control"], [["The lower torso drops below the shoulder-to-knee line at full reach", "The trunk loses its controlled braced shape", "Keep your ribs tucked and stop before your hips drop"]]),
];

export const EXERCISES: Exercise[] = SEEDS.map((item, index) => ({
  id: index + 1,
  slug: item.slug,
  name: item.name,
  category: item.category,
  equipment: item.equipment,
  aliases: item.aliases,
  profile: {
    camera: {
      preferredView: item.view,
      alternatives: item.alternatives ?? [],
      requiredLandmarks: item.landmarks,
      distanceMeters: [2, 3],
    },
    phases: item.phases,
    attentionAreas: item.attention,
    commonFaults: item.faults.map(fault),
    analysisInstruction: ANALYSIS_INSTRUCTION,
  },
}));

export function findExercise(slug: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.slug === slug);
}
