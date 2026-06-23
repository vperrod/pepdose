export type Severity = 'normal' | 'monitor' | 'stop';

export interface WeekGuide {
  weekStart: number;
  weekEnd: number;
  title: string;
  description: string;
  tips: string[];
}

export interface SideEffect {
  name: string;
  severity: Severity;
  likelihood: 'common' | 'uncommon' | 'rare';
  onset: string;
  duration: string;
  notes: string;
}

export interface PeptideExperience {
  peptideId: string;
  weeklyGuide: WeekGuide[];
  sideEffects: SideEffect[];
  redFlags: string[];
  postCycleNotes: string;
}

export const EXPERIENCE_DATA: PeptideExperience[] = [
  {
    peptideId: 'bpc-157',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 1,
        title: 'Adaptation Phase',
        description: 'Body adjusting to peptide. Injection site warmth/redness is normal. No noticeable healing effects yet.',
        tips: ['Focus on consistent injection timing', 'Rotate injection sites from day 1', 'Inject close to injury site if possible'],
      },
      {
        weekStart: 2, weekEnd: 2,
        title: 'Early Response',
        description: 'Some users report reduced pain and inflammation at injury site. Sleep quality may improve slightly.',
        tips: ['Track pain levels daily to notice gradual changes', 'Injection technique should be comfortable by now', 'Stay hydrated'],
      },
      {
        weekStart: 3, weekEnd: 4,
        title: 'Peak Healing Window',
        description: 'Most tissue repair effects reported in this window. Energy and recovery noticeably improved in many users.',
        tips: ['Continue consistent dosing — don\'t skip', 'Light exercise/rehab work pairs well', 'Monitor injury progress with photos'],
      },
      {
        weekStart: 5, weekEnd: 6,
        title: 'Consolidation',
        description: 'Effects plateau. Healing benefits continue but at diminishing rate. Plan off-cycle to prevent tolerance.',
        tips: ['Start planning off-cycle', 'Note your overall recovery for future reference', 'Taper is not required — can stop directly'],
      },
    ],
    sideEffects: [
      { name: 'Injection site redness', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: '15-30 minutes', notes: 'Mild warmth and redness. Subsides quickly.' },
      { name: 'Mild headache', severity: 'normal', likelihood: 'uncommon', onset: 'First few days', duration: '1-2 hours', notes: 'Usually resolves with hydration.' },
      { name: 'Dizziness', severity: 'monitor', likelihood: 'rare', onset: 'Variable', duration: 'Brief', notes: 'If persistent, reduce dose by 50%.' },
      { name: 'Nausea', severity: 'monitor', likelihood: 'rare', onset: 'First week', duration: 'Transient', notes: 'More common with oral/sublingual route.' },
    ],
    redFlags: [
      'Severe allergic reaction (hives, swelling, difficulty breathing)',
      'Persistent pain or lump at injection site lasting >48 hours',
      'Unusual swelling unrelated to injury site',
    ],
    postCycleNotes: 'Effects often persist 2-4 weeks after stopping. Monitor if healing progress continues. Safe to restart after 4-week off-cycle.',
  },
  {
    peptideId: 'tb-500',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'Loading Phase',
        description: 'Higher frequency dosing (2x/week) to build tissue levels. Some report mild fatigue as body mobilizes repair processes.',
        tips: ['Stick to loading dose schedule', 'Adequate sleep enhances repair', 'Mild fatigue is normal and temporary'],
      },
      {
        weekStart: 3, weekEnd: 4,
        title: 'Active Healing',
        description: 'Cell migration and angiogenesis effects peak. Injury site should show improvement. Flexibility may increase.',
        tips: ['Gentle mobility work encouraged', 'Document progress', 'Continue loading if prescribed'],
      },
      {
        weekStart: 5, weekEnd: 6,
        title: 'Maintenance Phase',
        description: 'Transition to weekly dosing. Effects maintained with lower frequency. Healing continues at steady pace.',
        tips: ['Can reduce to once weekly', 'Systemic inflammation should be noticeably reduced', 'Good time to reassess if cycle extension needed'],
      },
    ],
    sideEffects: [
      { name: 'Mild fatigue', severity: 'normal', likelihood: 'common', onset: 'Week 1-2', duration: '3-5 days', notes: 'Body diverting resources to repair. Normal.' },
      { name: 'Injection site irritation', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: 'Brief', notes: 'Rotate sites.' },
      { name: 'Head rush on standing', severity: 'monitor', likelihood: 'uncommon', onset: 'Variable', duration: 'Seconds', notes: 'TB-500 can lower blood pressure slightly. Rise slowly.' },
    ],
    redFlags: [
      'Persistent lethargy beyond week 2',
      'Unusual bruising or bleeding',
      'Signs of infection at injection site (increasing redness, heat, pus)',
    ],
    postCycleNotes: 'Tissue remodeling continues weeks after last dose. 4-week off-cycle recommended before restarting.',
  },
  {
    peptideId: 'semaglutide',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 4,
        title: 'GI Adjustment (0.25mg)',
        description: 'Body adapting to GLP-1 activation. Nausea is common (60-70% of users), usually mild. Appetite noticeably reduced. This is the adaptation dose — not for weight loss.',
        tips: ['Eat slowly and smaller portions', 'Avoid fatty/greasy foods', 'Stay very well hydrated', 'Ginger tea can help nausea', 'Don\'t force yourself to eat full meals'],
      },
      {
        weekStart: 5, weekEnd: 8,
        title: 'Early Weight Loss (0.5mg)',
        description: 'Nausea typically subsides. Weight loss begins — average 2-4 lbs/month. Food noise significantly reduced. Energy may dip temporarily.',
        tips: ['Prioritize protein intake (risk of muscle loss)', 'Light resistance training recommended', 'Track weight weekly, not daily', 'Some constipation possible — increase fiber'],
      },
      {
        weekStart: 9, weekEnd: 12,
        title: 'Therapeutic Range (1.0mg)',
        description: 'Significant appetite suppression. Weight loss accelerates. Most GI side effects have resolved. Body composition improving.',
        tips: ['Minimum 60-80g protein daily', 'Strength training important to preserve muscle', 'Monitor blood sugar if diabetic', 'Watch for constipation — fiber and water'],
      },
      {
        weekStart: 13, weekEnd: 16,
        title: 'Full Dose Titration (1.7mg)',
        description: 'Approaching maximum therapeutic dose. Appetite suppression strong. Weight loss continues. May experience brief GI symptoms with each dose increase.',
        tips: ['Each step-up may bring brief nausea — subsides in days', 'Track measurements, not just scale', 'Ensure adequate nutrition despite reduced appetite'],
      },
      {
        weekStart: 17, weekEnd: 999,
        title: 'Maintenance Dose (2.4mg)',
        description: 'Maximum approved dose. Weight loss continues to 12-18 months then stabilizes. Side effects should be stable and manageable.',
        tips: ['Continue indefinitely or discuss taper with provider', 'Monitor gallbladder symptoms at higher doses', 'Stopping abruptly may cause rebound weight gain', 'Regular bloodwork recommended every 3-6 months'],
      },
    ],
    sideEffects: [
      { name: 'Nausea', severity: 'normal', likelihood: 'common', onset: 'Weeks 1-4', duration: 'Subsides by week 4-6', notes: 'Most common side effect. Eat bland, small meals. Usually self-resolving.' },
      { name: 'Constipation', severity: 'normal', likelihood: 'common', onset: 'Weeks 2+', duration: 'Ongoing', notes: 'Increase fiber, water, and consider stool softener.' },
      { name: 'Diarrhea', severity: 'normal', likelihood: 'common', onset: 'First weeks', duration: 'Transient', notes: 'Less common than nausea. Usually resolves.' },
      { name: 'Fatigue', severity: 'normal', likelihood: 'common', onset: 'Weeks 1-3', duration: '1-2 weeks', notes: 'Related to reduced caloric intake. Ensure adequate nutrition.' },
      { name: 'Acid reflux/GERD', severity: 'monitor', likelihood: 'uncommon', onset: 'Variable', duration: 'Ongoing', notes: 'Avoid lying down after eating. May need OTC antacid.' },
      { name: 'Hair thinning', severity: 'monitor', likelihood: 'uncommon', onset: 'Months 3+', duration: 'Variable', notes: 'Related to rapid weight loss, not the drug directly. Ensure protein intake.' },
      { name: 'Gallbladder issues', severity: 'stop', likelihood: 'rare', onset: 'Any time', duration: 'N/A', notes: 'Severe right-side abdominal pain after fatty meals. Seek medical attention.' },
      { name: 'Pancreatitis', severity: 'stop', likelihood: 'rare', onset: 'Any time', duration: 'N/A', notes: 'Severe persistent abdominal pain radiating to back. Emergency — seek immediate care.' },
    ],
    redFlags: [
      'Severe abdominal pain that won\'t go away (pancreatitis risk)',
      'Persistent vomiting unable to keep fluids down',
      'Signs of allergic reaction (face/throat swelling)',
      'Changes in vision',
      'Severe right-side abdominal pain (gallstones)',
      'Signs of hypoglycemia if diabetic (shakiness, sweating, confusion)',
    ],
    postCycleNotes: 'Stopping semaglutide typically results in appetite return within 1-2 weeks and weight regain over 6-12 months. Discuss long-term plan with provider.',
  },
  {
    peptideId: 'tirzepatide',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 4,
        title: 'Introduction (2.5mg)',
        description: 'Dual GIP/GLP-1 activation beginning. GI side effects common but often milder than pure GLP-1 agonists. Appetite reduction starts.',
        tips: ['Same diet modifications as semaglutide', 'Nausea may be less intense than with semaglutide', 'Hydrate well'],
      },
      {
        weekStart: 5, weekEnd: 8,
        title: 'First Step-Up (5mg)',
        description: 'Weight loss begins in earnest. Appetite significantly reduced. GI symptoms may briefly return then settle.',
        tips: ['Prioritize protein (60-100g daily)', 'Begin or continue strength training', 'Track measurements and progress photos'],
      },
      {
        weekStart: 9, weekEnd: 12,
        title: 'Accelerating (7.5mg)',
        description: 'Robust weight loss phase. Body composition changing. Many users report improved energy and metabolic markers.',
        tips: ['Monitor blood glucose if applicable', 'Ensure vitamin/mineral supplementation', 'Keep consistent injection day'],
      },
      {
        weekStart: 13, weekEnd: 20,
        title: 'Therapeutic Range (10-12.5mg)',
        description: 'Strong metabolic effects. Average weight loss 15-22% of body weight by this point in clinical trials.',
        tips: ['Regular bloodwork recommended', 'Watch for injection site reactions at higher concentrations', 'Maintain nutrition despite low appetite'],
      },
      {
        weekStart: 21, weekEnd: 999,
        title: 'Maximum Dose (15mg)',
        description: 'Highest approved dose. Significant metabolic improvements. Weight loss plateaus around 12-18 months.',
        tips: ['Not everyone needs to reach 15mg — stay at dose that works', 'Long-term use — routine monitoring important', 'Discuss maintenance strategy with provider'],
      },
    ],
    sideEffects: [
      { name: 'Nausea', severity: 'normal', likelihood: 'common', onset: 'Each dose step-up', duration: '3-7 days', notes: 'Tends to be milder than with semaglutide. Eat small meals.' },
      { name: 'Decreased appetite', severity: 'normal', likelihood: 'common', onset: 'Week 1+', duration: 'Ongoing (desired)', notes: 'Expected therapeutic effect. Ensure minimum nutrition.' },
      { name: 'Injection site reaction', severity: 'normal', likelihood: 'uncommon', onset: 'Variable', duration: 'Hours', notes: 'Redness, itching at injection site. Rotate sites.' },
      { name: 'Pancreatitis', severity: 'stop', likelihood: 'rare', onset: 'Any time', duration: 'N/A', notes: 'Severe abdominal pain. Seek emergency care immediately.' },
    ],
    redFlags: [
      'Severe persistent abdominal pain (pancreatitis)',
      'Persistent vomiting, unable to eat or drink',
      'Thyroid lumps or neck swelling',
      'Severe allergic reaction',
    ],
    postCycleNotes: 'Similar to semaglutide — weight regain expected after discontinuation. Plan maintenance strategy.',
  },
  {
    peptideId: 'cjc-1295-no-dac',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'GH Pulse Activation',
        description: 'Body beginning to respond with enhanced GH pulses. Sleep quality often improves first. May feel slightly more rested.',
        tips: ['Inject on empty stomach (2+ hours no food)', 'Pre-bed timing maximizes natural GH pulse', 'Best combined with Ipamorelin'],
      },
      {
        weekStart: 3, weekEnd: 6,
        title: 'Early Benefits',
        description: 'Improved sleep deepening. Skin quality may improve. Recovery from workouts faster. Fat loss subtle but beginning.',
        tips: ['Don\'t eat within 30 min after injection (blunts GH)', 'Track sleep quality', 'Body composition changes are gradual'],
      },
      {
        weekStart: 7, weekEnd: 12,
        title: 'Full Effects',
        description: 'Peak GH/IGF-1 elevation. Noticeable improvements in recovery, body composition, skin, hair, and energy. Fat loss and lean mass gains.',
        tips: ['Consider bloodwork at week 8 to check IGF-1 levels', 'Maintain consistent timing', 'Effects compound over time'],
      },
    ],
    sideEffects: [
      { name: 'Tingling/numbness in hands', severity: 'normal', likelihood: 'common', onset: 'Weeks 2-4', duration: 'Transient', notes: 'Sign of elevated GH. Usually mild and resolves. Reduce dose if bothersome.' },
      { name: 'Water retention', severity: 'normal', likelihood: 'common', onset: 'Weeks 1-3', duration: 'Variable', notes: 'Mild bloating. GH-related. Reduces with time or lower dose.' },
      { name: 'Increased hunger', severity: 'normal', likelihood: 'common', onset: 'Week 1+', duration: 'Ongoing', notes: 'GH increases appetite. Channel into protein-rich meals.' },
      { name: 'Joint pain', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 4+', duration: 'Variable', notes: 'May indicate IGF-1 too high. Get bloodwork. Reduce dose.' },
    ],
    redFlags: [
      'Persistent severe headaches',
      'Vision changes',
      'Significant joint swelling (IGF-1 too high)',
      'Carpal tunnel symptoms that don\'t resolve',
    ],
    postCycleNotes: 'GH levels return to baseline within 1-2 weeks of stopping. 4-week off-cycle maintains receptor sensitivity for next cycle.',
  },
  {
    peptideId: 'ipamorelin',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'Initial Response',
        description: 'Selective GH release begins. Fewer side effects than other GHRPs (minimal cortisol/prolactin impact). Sleep improves.',
        tips: ['Fasting required before injection', 'Pre-bed dosing optimal', 'Pair with CJC-1295 (no DAC) for best results'],
      },
      {
        weekStart: 3, weekEnd: 8,
        title: 'Building Effects',
        description: 'Progressive improvements in sleep, recovery, skin quality. Fat oxidation increasing. Lean mass slowly improving.',
        tips: ['Results are gradual — trust the process', 'Consistent timing matters', 'Track body measurements weekly'],
      },
      {
        weekStart: 9, weekEnd: 12,
        title: 'Peak Benefits',
        description: 'Full GH optimization. Best results in conjunction with proper training and nutrition. Noticeable body recomposition.',
        tips: ['Bloodwork recommended to check IGF-1', 'Plan off-cycle timing', 'Document results for future cycles'],
      },
    ],
    sideEffects: [
      { name: 'Mild hunger increase', severity: 'normal', likelihood: 'common', onset: 'Post-injection', duration: '30-60 minutes', notes: 'Ghrelin receptor activation. Brief and mild compared to other GHRPs.' },
      { name: 'Head rush', severity: 'normal', likelihood: 'uncommon', onset: 'Post-injection', duration: 'Seconds', notes: 'Brief lightheadedness. Sit during injection.' },
      { name: 'Water retention', severity: 'normal', likelihood: 'uncommon', onset: 'Weeks 2+', duration: 'Variable', notes: 'Milder than with CJC-1295 alone.' },
    ],
    redFlags: [
      'Persistent carpal tunnel symptoms',
      'Joint pain with swelling',
      'Glucose/insulin issues (get bloodwork)',
    ],
    postCycleNotes: 'One of the safest GH peptides. Receptor sensitivity returns within 4 weeks off.',
  },
  {
    peptideId: 'mk-677',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'Appetite Surge',
        description: 'Oral ghrelin mimetic kicks in fast. Hunger significantly increased. Water retention begins. Sleep deepens noticeably.',
        tips: ['Take before bed to sleep through hunger spike', 'Water retention is normal — not fat gain', 'Start at 10mg if concerned about sides'],
      },
      {
        weekStart: 3, weekEnd: 6,
        title: 'GH/IGF-1 Rising',
        description: 'IGF-1 levels climbing. Recovery improving. Skin and hair quality better. Appetite normalizes somewhat.',
        tips: ['Monitor fasting blood glucose', 'Appetite usually stabilizes by week 4', 'Strength gains may begin'],
      },
      {
        weekStart: 7, weekEnd: 12,
        title: 'Full Activation',
        description: 'Peak GH benefits. Body composition improving. Sleep very deep. Some users report vivid dreams.',
        tips: ['Check IGF-1 and fasting glucose at week 8', 'If glucose elevated, consider lower dose or cycle off', 'Lean mass gains most noticeable in this window'],
      },
    ],
    sideEffects: [
      { name: 'Intense hunger', severity: 'normal', likelihood: 'common', onset: 'Day 1', duration: 'Weeks 1-3 peak', notes: 'Strongest side effect. Bedtime dosing helps. Subsides partially.' },
      { name: 'Water retention/bloating', severity: 'normal', likelihood: 'common', onset: 'Week 1', duration: 'Ongoing', notes: '3-5 lbs water weight common. Resolves when stopped.' },
      { name: 'Lethargy', severity: 'normal', likelihood: 'common', onset: 'Post-dose', duration: '1-2 hours', notes: 'Take before bed. Actually enhances sleep quality.' },
      { name: 'Elevated blood glucose', severity: 'monitor', likelihood: 'common', onset: 'Weeks 4+', duration: 'While on compound', notes: 'GH causes insulin resistance. Monitor fasting glucose. Critical for pre-diabetics.' },
      { name: 'Numbness/tingling', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 4+', duration: 'Variable', notes: 'GH-related. If persistent, reduce dose.' },
    ],
    redFlags: [
      'Fasting blood glucose consistently above 100 mg/dL',
      'Signs of diabetes (excessive thirst, frequent urination)',
      'Severe edema (significant swelling beyond mild bloating)',
      'Persistent joint pain',
    ],
    postCycleNotes: 'GH levels drop within days of stopping. Water weight drops in 1-2 weeks. IGF-1 normalizes in 2-3 weeks.',
  },
  {
    peptideId: 'aod-9604',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 3,
        title: 'Fat Mobilization Begins',
        description: 'Lipolysis stimulation starting. No visible changes yet — fat metabolism takes time. No GH-like side effects.',
        tips: ['Inject fasting for best absorption', 'Morning SubQ near abdomen preferred', 'Don\'t expect rapid results — fat loss is gradual'],
      },
      {
        weekStart: 4, weekEnd: 8,
        title: 'Visible Progress',
        description: 'Fat loss becoming noticeable, especially stubborn areas. No impact on blood glucose or insulin (key advantage over GH).',
        tips: ['Combine with exercise for best results', 'Track waist measurements, not just weight', 'Body recomposition may mean scale doesn\'t move much'],
      },
      {
        weekStart: 9, weekEnd: 12,
        title: 'Continued Fat Loss',
        description: 'Sustained lipolysis. Results continue but rate may slow. Most users see meaningful reduction in stubborn fat deposits.',
        tips: ['Plan next cycle or off-period', 'Take progress photos for comparison', 'Maintain caloric deficit for maximum effect'],
      },
    ],
    sideEffects: [
      { name: 'Injection site redness', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: 'Minutes', notes: 'Very mild. Normal.' },
      { name: 'Mild headache', severity: 'normal', likelihood: 'uncommon', onset: 'First days', duration: 'Hours', notes: 'Usually hydration-related.' },
    ],
    redFlags: [
      'Unusual joint pain (shouldn\'t occur — AOD-9604 lacks GH activity)',
      'Severe allergic reaction',
    ],
    postCycleNotes: 'Fat loss results are retained if diet/exercise maintained. Off-cycle resets lipase sensitivity for next round.',
  },
  {
    peptideId: 'pt-141',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 1,
        title: 'As-Needed Use',
        description: 'PT-141 is not cycled daily — used 45 minutes before activity. First use establishes your response level.',
        tips: ['Start with 0.5-1mg to assess tolerance', 'Effects begin 30-60 min after injection', 'Nausea is common on first use — subsides with experience', 'Max 8 doses per month'],
      },
    ],
    sideEffects: [
      { name: 'Nausea', severity: 'normal', likelihood: 'common', onset: '15-30 minutes', duration: '1-2 hours', notes: 'Most common side effect. Starts mild, subsides. Lower dose if severe.' },
      { name: 'Facial flushing', severity: 'normal', likelihood: 'common', onset: '30-60 minutes', duration: '2-4 hours', notes: 'Melanocortin receptor activation. Normal and expected.' },
      { name: 'Mild headache', severity: 'normal', likelihood: 'uncommon', onset: '1-2 hours', duration: 'Hours', notes: 'Usually mild. Stay hydrated.' },
      { name: 'Blood pressure increase', severity: 'monitor', likelihood: 'uncommon', onset: '30-60 minutes', duration: 'Hours', notes: 'Transient BP rise. Avoid if you have uncontrolled hypertension.' },
    ],
    redFlags: [
      'Severe or prolonged nausea/vomiting',
      'Chest pain or severe headache',
      'Priapism (erection lasting >4 hours — seek emergency care)',
      'Significant blood pressure spike',
    ],
    postCycleNotes: 'No cycling needed — as-needed use only. Do not exceed 8 doses per month. Effects don\'t diminish with proper spacing.',
  },
  {
    peptideId: 'ghk-cu',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'Collagen Stimulation Begins',
        description: 'Copper peptide signaling initiating collagen remodeling. No visible changes yet. Working at cellular level.',
        tips: ['Can inject SubQ or use topically', 'Pairs well with BPC-157 for tissue repair', 'Results take time — collagen builds slowly'],
      },
      {
        weekStart: 3, weekEnd: 5,
        title: 'Early Skin/Tissue Changes',
        description: 'Skin elasticity beginning to improve. Wound healing accelerated. Hair growth may improve.',
        tips: ['Consistency is key', 'Topical application to face for skin benefits', 'Track skin quality with photos'],
      },
      {
        weekStart: 6, weekEnd: 8,
        title: 'Visible Improvements',
        description: 'Noticeable skin quality improvement. Fine lines may soften. Overall tissue quality enhanced.',
        tips: ['Plan off-cycle to prevent copper accumulation', 'Results persist after stopping', 'Document results for future reference'],
      },
    ],
    sideEffects: [
      { name: 'Injection site staining', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: 'Days', notes: 'Blue-green discoloration from copper. Fades in 2-3 days.' },
      { name: 'Mild nausea', severity: 'normal', likelihood: 'uncommon', onset: 'Post-injection', duration: 'Brief', notes: 'More common at higher doses.' },
    ],
    redFlags: [
      'Signs of copper toxicity (metallic taste, severe nausea, abdominal pain)',
      'Liver discomfort',
    ],
    postCycleNotes: 'Collagen benefits persist well after stopping. 4-week minimum off-cycle prevents copper accumulation.',
  },
  {
    peptideId: 'epithalon',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'Telomerase Activation',
        description: 'Short intense protocol: 10mg daily for 10-20 days. Telomerase activation begins. Sleep often improves via melatonin regulation.',
        tips: ['This is a short cycle — consistency each day matters', 'Best done 1-2x per year', 'Morning injection preferred'],
      },
    ],
    sideEffects: [
      { name: 'Improved sleep', severity: 'normal', likelihood: 'common', onset: 'Days 3-5', duration: 'Weeks after', notes: 'Positive side effect — melatonin regulation. Welcome benefit.' },
      { name: 'Injection site discomfort', severity: 'normal', likelihood: 'uncommon', onset: 'Immediate', duration: 'Minutes', notes: 'Mild and brief.' },
    ],
    redFlags: [
      'Allergic reaction',
      'Persistent injection site issues',
    ],
    postCycleNotes: 'Telomerase activation effects are thought to persist for months. Repeat cycle every 4-6 months. One of the safest peptides documented.',
  },
  {
    peptideId: 'retatrutide',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'The Adjustment (2mg)',
        description: 'Most Reddit users start at 2mg. Appetite suppression kicks in fast — many report noticeably less hunger within 48 hours. Nausea is common but users say it\'s milder than sema at similar weight-loss levels. Expect increased urination (glucagon effect) and early water weight loss. Some users start at 1mg to test tolerance.',
        tips: ['Eat small meals before hunger vanishes completely — "food noise" disappears fast', 'Hydrate aggressively — the extra urination is real', '"Sulfur burps" are a common Reddit complaint, especially with fatty food', 'First week water loss can be dramatic — don\'t get excited, real fat loss comes later'],
      },
      {
        weekStart: 3, weekEnd: 6,
        title: 'Finding Your Dose (4mg)',
        description: 'Community consensus: 4mg is where real weight loss starts. Reddit users report 5-10% loss in the first 8-12 weeks. GI side effects from the step-up usually settle in 3-5 days. Energy levels are a mixed bag — some feel great, others report fatigue. The triple receptor hit (GIP + GLP-1 + glucagon) feels different from pure GLP-1 drugs.',
        tips: ['Protein first — 80-100g daily minimum. Reddit users who skip this lose muscle', 'Start or maintain strength training — community strongly recommends this', 'If nausea is rough, some users split their weekly dose into two shots', 'Track measurements AND photos, not just scale — body recomposition is real'],
      },
      {
        weekStart: 7, weekEnd: 12,
        title: 'The Sweet Spot (8mg)',
        description: 'Many Reddit users find 8mg is their maintenance dose and don\'t need to go higher. Fat loss accelerates noticeably. Community reports: reduced food noise, better blood sugar, and improved lipid panels. Some users report hitting a plateau around month 3 — this is normal and usually breaks. Liver enzymes may bump slightly.',
        tips: ['Get bloodwork — liver enzymes and lipids. Reddit consensus: every 3 months', 'If you plateau, hold dose steady — most break through within 2-3 weeks', 'Some users report improved sleep and mood at this dose', 'Consider staying here if side effects are manageable — not everyone needs 12mg'],
      },
      {
        weekStart: 13, weekEnd: 999,
        title: 'Maximum Push (12mg)',
        description: 'Only go here if 8mg isn\'t enough. Reddit users at 12mg report the strongest appetite suppression and fastest loss (15-25% at 6-12 months). Side effects intensify — nausea, fatigue, and GI issues are more common. Community advice: if you\'re losing well at 8mg, stay there. Faster titration (common on Reddit) correlates with worse side effects.',
        tips: ['Not everyone needs this — many Reddit users plateau at 8mg and are satisfied', 'Side effect management becomes more important: smaller meals, more water, anti-nausea', 'Watch for gallbladder symptoms during rapid loss — a real risk per community reports', 'Plan your exit strategy — Reddit reports suggest appetite returns after stopping'],
      },
    ],
    sideEffects: [
      { name: 'Nausea', severity: 'normal', likelihood: 'common', onset: 'Each dose step-up', duration: '3-7 days', notes: 'The #1 Reddit complaint. Milder than sema for most users. Worse with fast food and fatty meals.' },
      { name: '"Sulfur burps"', severity: 'normal', likelihood: 'common', onset: 'Week 1+', duration: 'Variable', notes: 'Community hallmark of all GLP-1 drugs. Egg-like burps. Worse with greasy food. Some users find ginger helps.' },
      { name: 'Appetite gone / food aversion', severity: 'normal', likelihood: 'common', onset: 'Week 1+', duration: 'Ongoing', notes: 'Desired effect but can become problematic. Reddit users warn: force yourself to eat protein even when not hungry.' },
      { name: 'Fatigue', severity: 'normal', likelihood: 'common', onset: 'Weeks 1-4', duration: 'Usually transient', notes: 'Very commonly discussed. Usually resolves as body adapts. May be caloric deficit related.' },
      { name: 'Constipation', severity: 'normal', likelihood: 'common', onset: 'Weeks 2+', duration: 'Variable', notes: 'GLP-1 slows gastric emptying. Community fix: fiber supplement, magnesium, hydration.' },
      { name: 'Increased urination', severity: 'normal', likelihood: 'common', onset: 'Week 1+', duration: 'Ongoing', notes: 'Glucagon receptor effect unique to reta. Stay hydrated. Not diabetes.' },
      { name: 'Heartburn / reflux', severity: 'monitor', likelihood: 'common', onset: 'Weeks 2+', duration: 'While on drug', notes: 'Delayed gastric emptying. Sleep elevated if bad. Some users take OTC antacids.' },
      { name: 'Injection site reactions', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: 'Hours', notes: 'Welts, redness, itching at site. Usually mild. Rotate sites.' },
      { name: 'Vomiting', severity: 'monitor', likelihood: 'uncommon', onset: 'After dose increases', duration: '1-3 days', notes: 'More common with fast titration. Reddit advice: slow down your step-ups if this happens.' },
      { name: 'Pancreatitis', severity: 'stop', likelihood: 'rare', onset: 'Any time', duration: 'N/A', notes: 'Some Reddit users report ER visits for severe abdominal pain. Seek emergency care for pain radiating to back.' },
      { name: 'Gallbladder events', severity: 'stop', likelihood: 'rare', onset: 'With rapid weight loss', duration: 'N/A', notes: 'Community reports of gallbladder removal during rapid loss. Right-side pain after fatty meals = get checked.' },
    ],
    redFlags: [
      'Severe abdominal pain radiating to back (pancreatitis — ER immediately)',
      'Can\'t keep any fluids down for 24+ hours (dehydration/kidney risk)',
      'Right-side pain after eating (gallbladder — Reddit reports surgical cases)',
      'Injection site abscess or spreading infection (contamination risk with research-grade)',
      '"Stomach paralysis" feeling that persists after stopping (gastroparesis)',
      'Severe fatigue with yellow skin/eyes (liver — get bloodwork)',
    ],
    postCycleNotes: 'Not FDA-approved (TRIUMPH Phase 3 ongoing). Reddit consensus: appetite and weight return after stopping, similar to other GLP-1s. Community advice: build exercise habits and protein-focused diet during treatment so you keep those after. Some users cycle on/off. Discuss long-term plan with provider.',
  },
  {
    peptideId: 'glow-blend',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'Priming Phase — Nothing Visible Yet',
        description: 'Daily SubQ injections. GHK-Cu activates 300+ tissue repair genes and triggers fibroblast growth. BPC-157 builds new capillary networks (angiogenesis). TB-500 mobilizes repair cells via actin regulation. Users report no visible changes — this is cellular-level work. Plastic surgeons who prescribe GLOW post-op say this phase is critical foundation.',
        tips: ['Blue-green tint in syringe is normal — that\'s the copper peptide', 'Rotate injection sites (abdomen or thigh) to avoid bruising buildup', 'Take close-up progress photos in consistent lighting — you\'ll want them later', 'If pairing with weight loss (reta/sema), this is when skin protection starts'],
      },
      {
        weekStart: 3, weekEnd: 4,
        title: 'First Signs — Healing & Texture',
        description: 'Still daily. Users report cuts and scrapes healing noticeably faster. Skin starts feeling slightly firmer or "plumper." Hair and nail growth improvement mentioned in community posts. Post-surgical patients report incision scars healing flatter and lighter. The BPC-157 + TB-500 synergy is doing the heavy lifting — BPC builds blood supply, TB-500 sends repair cells to use it.',
        tips: ['Consistency is everything — don\'t skip days in this window', 'Vitamin C supplementation supports collagen synthesis', 'Stay hydrated — collagen building requires water', 'Some users report deeper sleep during this phase'],
      },
      {
        weekStart: 5, weekEnd: 8,
        title: 'Visible Results — Skin Quality',
        description: 'Step down to 5x/week. This is when community members start seeing real results — improved elasticity, finer texture, reduced fine lines, "glow" that others notice. Users on GLP-1 weight loss say skin tightening keeps pace with fat loss instead of going saggy. One plastic surgeon (Dr. Agullo) doses patients daily for 3-4 weeks post-op then adjusts — you can follow similar tapering.',
        tips: ['5 on / 2 off lets collagen organize during rest days', 'Compare your week 1 photos — changes are gradual so you might miss them', 'Reddit users doing reta + GLOW say this combo prevents the "Ozempic face"', 'Plan your off-cycle: 4-8 weeks break, then 2-3x/week maintenance if continuing'],
      },
    ],
    sideEffects: [
      { name: 'Blue-green injection site staining', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: '2-3 days', notes: 'Copper from GHK-Cu. Purely cosmetic — fades on its own. Rotate sites to spread it out.' },
      { name: 'Injection site welts/redness', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: '15-60 minutes', notes: 'Normal SubQ reaction. Brief warmth and redness. Goes away quickly.' },
      { name: 'Mild nausea', severity: 'normal', likelihood: 'uncommon', onset: 'Post-injection', duration: 'Brief', notes: 'More common at higher doses or if injected on empty stomach.' },
      { name: 'Metallic taste', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 4+', duration: 'Variable', notes: 'Community red flag for copper accumulation. Reduce dose or start off-cycle early.' },
      { name: 'GI discomfort', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 4+', duration: 'Variable', notes: 'Another copper saturation signal. Take a break if this appears.' },
    ],
    redFlags: [
      'Persistent metallic taste that won\'t go away (copper toxicity — stop immediately)',
      'Injection site abscess or spreading infection (not just redness — actual heat/pus)',
      'Severe nausea or abdominal pain',
      'Yellow skin or eyes (liver — get bloodwork)',
    ],
    postCycleNotes: 'Collagen remodeling is structural — benefits persist well after stopping. Community protocol: 4-8 weeks off, then 2-3x/week maintenance. Monitor copper levels with bloodwork if running multiple cycles back-to-back. Users report skin quality holds for months post-cycle.',
  },
];

export function getExperienceForPeptide(peptideId: string): PeptideExperience | undefined {
  return EXPERIENCE_DATA.find(e => e.peptideId === peptideId);
}

export function getCurrentWeekGuide(peptideId: string, currentWeek: number): WeekGuide | undefined {
  const exp = getExperienceForPeptide(peptideId);
  if (!exp) return undefined;
  return exp.weeklyGuide.find(g => currentWeek >= g.weekStart && currentWeek <= g.weekEnd);
}
