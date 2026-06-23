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
];

  {
    peptideId: 'retatrutide',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 4,
        title: 'Introduction (2mg)',
        description: 'Starting dose to assess GI tolerance. Triple receptor activation (GIP + GLP-1 + glucagon) begins. Appetite reduction starts within days. Nausea common but typically milder than semaglutide at equivalent weight-loss doses.',
        tips: ['Eat slowly, avoid greasy/fatty foods', 'Stay well hydrated — glucagon component increases urination', 'Appetite reduction may be noticeable within 48 hours', 'Don\'t be alarmed by early weight loss (mostly water from glucagon effect)'],
      },
      {
        weekStart: 5, weekEnd: 8,
        title: 'First Step-Up (4mg)',
        description: 'Meaningful weight loss begins. Phase 2 trial showed -12.9% body weight at 24 weeks at this dose. GI side effects from step-up usually resolve within a week. Glucagon receptor activation increases energy expenditure.',
        tips: ['Prioritize protein (80-100g daily) — muscle preservation critical', 'Resistance training strongly recommended', 'Brief nausea after dose increase is normal — settles in 3-5 days', 'Track measurements weekly, not just scale weight'],
      },
      {
        weekStart: 9, weekEnd: 12,
        title: 'Accelerating (8mg)',
        description: 'Robust fat loss phase. Phase 2 trial: -17.3% body weight at 24 weeks. Hepatic fat reduction from glucagon component (unique vs pure GLP-1 agonists). Energy expenditure increased.',
        tips: ['Liver enzyme monitoring recommended at this dose', 'Lipid panel likely improving significantly', 'Ensure adequate vitamin/mineral supplementation', 'If GI symptoms persist, consider staying at 4mg longer'],
      },
      {
        weekStart: 13, weekEnd: 999,
        title: 'Maximum Dose (12mg)',
        description: 'Highest tested dose. Phase 2 trial: -24.2% body weight at 48 weeks — most potent weight loss of any peptide in clinical trials. Metabolic improvements across glucose, lipids, liver fat, and blood pressure.',
        tips: ['Not everyone needs 12mg — stay at dose that works for you', 'Regular bloodwork every 3 months (liver enzymes, lipids, glucose)', 'Continue high-protein diet and strength training', 'Watch for signs of gallbladder issues at rapid weight loss rates'],
      },
    ],
    sideEffects: [
      { name: 'Nausea', severity: 'normal', likelihood: 'common', onset: 'Each dose step-up', duration: '3-7 days', notes: 'Most common. Start at 2mg to minimize. Generally milder than semaglutide at equivalent weight loss.' },
      { name: 'Diarrhea', severity: 'normal', likelihood: 'common', onset: 'Weeks 1-4', duration: 'Transient', notes: 'Glucagon component can cause loose stools initially. Usually resolves.' },
      { name: 'Decreased appetite', severity: 'normal', likelihood: 'common', onset: 'Week 1+', duration: 'Ongoing (desired)', notes: 'Therapeutic effect. Ensure minimum nutrition despite low appetite.' },
      { name: 'Increased urination', severity: 'normal', likelihood: 'common', onset: 'Week 1+', duration: 'Ongoing', notes: 'Glucagon receptor activation. Stay hydrated. Not a sign of diabetes.' },
      { name: 'Constipation', severity: 'normal', likelihood: 'common', onset: 'Weeks 2+', duration: 'Variable', notes: 'GLP-1 slows gastric emptying. Increase fiber and water.' },
      { name: 'Heart rate increase', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 4+', duration: 'While on drug', notes: 'Small increases (2-4 bpm) seen in trials. Monitor if significant.' },
      { name: 'Elevated liver enzymes', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 8+', duration: 'While on drug', notes: 'Get bloodwork. Usually mild and transient. Reduce dose if persistent.' },
      { name: 'Pancreatitis', severity: 'stop', likelihood: 'rare', onset: 'Any time', duration: 'N/A', notes: 'Severe abdominal pain radiating to back. Seek emergency care immediately.' },
      { name: 'Gallbladder issues', severity: 'stop', likelihood: 'rare', onset: 'With rapid weight loss', duration: 'N/A', notes: 'Right-side abdominal pain after fatty meals. Seek medical attention.' },
    ],
    redFlags: [
      'Severe abdominal pain that won\'t go away (pancreatitis risk)',
      'Persistent vomiting, unable to keep fluids down',
      'Right-side abdominal pain after eating (gallstones)',
      'Significant liver enzyme elevation on bloodwork',
      'Signs of allergic reaction (face/throat swelling)',
      'Severe or unexplained fatigue (check liver function)',
    ],
    postCycleNotes: 'Phase 3 trials (TRIUMPH program) ongoing — not yet FDA-approved. Stopping will likely result in appetite return and weight regain similar to other GLP-1 agonists. Discuss long-term strategy with provider. Maintain exercise habits built during treatment.',
  },
  {
    peptideId: 'glow-blend',
    weeklyGuide: [
      {
        weekStart: 1, weekEnd: 2,
        title: 'Collagen Signaling Begins',
        description: 'Daily SubQ injection phase. GHK-Cu initiates collagen remodeling and clears damaged tissue. BPC-157 restores blood flow to repair areas. TB-500 mobilizes repair cells. No visible changes yet — working at cellular level.',
        tips: ['Inject abdomen or thigh — rotate sites', 'Blue-green tint in syringe is normal (copper)', 'Pair with weight-loss protocol for skin laxity prevention', 'Take progress photos for comparison later'],
      },
      {
        weekStart: 3, weekEnd: 4,
        title: 'Early Tissue Response',
        description: 'Still daily dosing. Collagen synthesis accelerating. Skin may feel slightly firmer. Wound healing noticeably faster if any cuts/scrapes. Hair and nail growth may improve.',
        tips: ['Consistency every day is critical in this window', 'Hydrate well — collagen synthesis requires water', 'Vitamin C supplementation supports collagen building', 'Avoid sun damage to areas you\'re trying to improve'],
      },
      {
        weekStart: 5, weekEnd: 8,
        title: 'Visible Improvements',
        description: 'Step down to 5x/week. Skin quality visibly improving — elasticity, texture, fine lines. This is when most users see noticeable changes. Collagen organization occurring during rest days.',
        tips: ['5 days on, 2 days off allows collagen organization', 'Compare progress photos from week 1', 'Skin tightening effects compound over time', 'Plan transition to maintenance or off-cycle'],
      },
    ],
    sideEffects: [
      { name: 'Injection site blue-green staining', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: '2-3 days', notes: 'Copper from GHK-Cu. Cosmetic only — fades naturally. Rotate sites.' },
      { name: 'Mild injection site redness', severity: 'normal', likelihood: 'common', onset: 'Immediate', duration: '15-30 minutes', notes: 'Normal SubQ reaction. Brief warmth at site.' },
      { name: 'Mild nausea', severity: 'normal', likelihood: 'uncommon', onset: 'Post-injection', duration: 'Brief', notes: 'More common at higher doses. Take with light meal if persistent.' },
      { name: 'Metallic taste', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 4+', duration: 'Variable', notes: 'May indicate copper saturation. Consider reducing dose or starting off-cycle early.' },
      { name: 'GI discomfort', severity: 'monitor', likelihood: 'uncommon', onset: 'Weeks 4+', duration: 'Variable', notes: 'Another copper accumulation signal. Reduce frequency or take break.' },
    ],
    redFlags: [
      'Persistent metallic taste (copper toxicity sign — stop and take off-cycle)',
      'Severe nausea or abdominal pain',
      'Liver discomfort or jaundice',
      'Allergic reaction at injection site (spreading redness, hives)',
    ],
    postCycleNotes: 'Collagen benefits persist well after stopping — structural changes are lasting. Take 4-8 weeks off, then restart or continue 2-3x/week maintenance. Monitor copper levels with bloodwork if running multiple cycles.',
  },

export function getExperienceForPeptide(peptideId: string): PeptideExperience | undefined {
  return EXPERIENCE_DATA.find(e => e.peptideId === peptideId);
}

export function getCurrentWeekGuide(peptideId: string, currentWeek: number): WeekGuide | undefined {
  const exp = getExperienceForPeptide(peptideId);
  if (!exp) return undefined;
  return exp.weeklyGuide.find(g => currentWeek >= g.weekStart && currentWeek <= g.weekEnd);
}
