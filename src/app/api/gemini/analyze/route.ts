import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fmtRas } from '@/lib/reportFacts';
import type { ReportFacts } from '@/lib/reportFacts';

export const maxDuration = 60;

interface Narrative {
  surgeon: { summary: string; points: string[] };
  patient: { summary: string; points: string[]; questions: string[] };
}

const STRING_LIST = { type: 'ARRAY', items: { type: 'STRING' } };
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    surgeon: {
      type: 'OBJECT',
      properties: { summary: { type: 'STRING' }, points: STRING_LIST },
      required: ['summary', 'points'],
    },
    patient: {
      type: 'OBJECT',
      properties: { summary: { type: 'STRING' }, points: STRING_LIST, questions: STRING_LIST },
      required: ['summary', 'points', 'questions'],
    },
  },
  required: ['surgeon', 'patient'],
};

const f1 = (n: number) => n.toFixed(1);
// Lowercase only the first letter so acronyms like MCA or SMA survive mid-sentence
const lc = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const article = (n: number) => (/^(8|11|18)/.test(n.toFixed(1)) ? 'an' : 'a');

function factsForPrompt(f: ReportFacts) {
  const a = f.approach;
  const lines = [
    `Lesion: ${f1(f.lesion.volumeCm3)} cm³ (${f1(f.lesion.diameterMm)} mm diameter) in the ${f.lesion.location}, ${f.lesion.lobe} lobe, ${f.lesion.side} side. Language-dominant hemisphere: ${f.lesion.dominantHemisphere}. ${f1(f.lesion.depthFromCortexMm)} mm below the nearest cortical surface.`,
    f.lesion.nearestEloquent
      ? `Nearest eloquent region: ${f.lesion.nearestEloquent.name} (${f.lesion.nearestEloquent.fn}), ${f1(f.lesion.nearestEloquent.distanceMm)} mm from the tumor margin.`
      : 'No eloquent region flagged near the lesion.',
    a
      ? `${f.route.isRecommended ? 'Recommended corridor' : `Corridor the surgeon selected (${f.route.label}, not the recommended one)`}: ${a.approach}, heading ${a.heading}, ${a.angleFromVerticalDeg.toFixed(0)}° from vertical, ${f1(a.depthMm)} mm from cortex to tumor margin, entry ${fmtRas(a.entryRas)}. Passes through: ${a.crossed.map((c) => c.name).join(', ') || 'no named region beyond the entry'}. Closest eloquent regions to the corridor: ${a.closest.map((c) => `${c.name} ${f1(c.clearanceMm)} mm`).join('; ')}. Positioning: ${a.positioning}.`
      : `No acceptable transcortical corridor: ${f.noCorridorReason}`,
    ...f.alternatives.map((alt) => `${alt.label} route: ${alt.approach}, ${alt.heading}, ${f1(alt.depthMm)} mm deep. ${alt.isRecommended ? `This is the recommended route: ${alt.note}.` : `Not preferred because ${alt.note}.`}`),
    `Brain shift after resection: max ${f.shift.maxShiftMm.toFixed(2)} mm, average stress ${f.shift.avgStressKpa.toFixed(2)} kPa, ${f1(f.shift.affectedCm3)} cm³ of tissue moves more than 0.5 mm. Most stressed: ${f.shift.mostStressed.map((s) => `${s.name} ${s.peakKpa.toFixed(2)} kPa`).join('; ')}.`,
    f.shift.phases?.length
      ? `Shift through the operation: ${f.shift.phases.map((p) => `${p.label}: max ${f1(p.maxShiftMm)} mm, deep margin ${f1(p.deepMarginShiftMm)} mm`).join('; ')}. The retractor pushes tissue aside by up to half the corridor width.`
      : '',
    `Structures at risk: ${f.risks.slice(0, 6).map((r) => `${r.name} (${r.fn}, ${r.level}, ${f1(r.distanceMm)} mm from tumor${r.crossed ? ', crossed by corridor' : ''})`).join('; ')}.`,
    `Planning checklist already shown to the surgeon: ${f.checklist.join(' | ')}`,
  ];
  return lines.join('\n');
}

function buildPrompt(f: ReportFacts, query: string | null) {
  return `You are a neurosurgical planning assistant writing the narrative part of a pre-op report. The tables in the report already show every number below, so your job is to explain what they mean.

${factsForPrompt(f)}

Write JSON with:
"surgeon.summary": 4 to 5 sentences for the operating surgeon. Say where the lesion is, the corridor being planned and how it compares with the other routes (if it is not the recommended one, say plainly what it costs), what is most at risk, and what the brain shift means for navigation. Talk directly to the surgeon ("you"), like a senior colleague at a planning meeting.
"surgeon.points": 4 to 5 specific things to watch during the case, each one sentence under 25 words, ordered by importance.
"patient.summary": 3 sentences in plain words for the patient. No jargon, no gyrus names, say "the part of the brain that controls movement" instead.
"patient.points": 3 short reassurances or facts, each under 20 words.
"patient.questions": 3 questions the patient could ask their surgeon, each under 15 words.

Rules: only use the numbers above, never invent statistics, outcomes, percentages or recovery times. No markdown, no headings, no bullet symbols, no emoji. This comes from a template brain and a simplified model, so do not present it as a diagnosis.${query ? `\n\nThe reader also asks: ${query}` : ''}`;
}

// Same structure and voice as the model output, built from the facts, for when no API key is set
function fallbackNarrative(f: ReportFacts): Narrative {
  const a = f.approach;
  const loc = f.lesion.location.toLowerCase();
  const near = f.lesion.nearestEloquent;
  const top = f.risks[0];
  const shift = f.shift.maxShiftMm;
  const alt = f.alternatives.find((x) => !x.isRecommended);
  const rec = f.alternatives.find((x) => x.isRecommended);

  const summary = [
    `This is ${article(f.lesion.volumeCm3)} ${f1(f.lesion.volumeCm3)} cm³ lesion in the ${loc}, ${f1(f.lesion.depthFromCortexMm)} mm below the surface, ${f.lesion.side === 'midline' ? 'at the midline' : `in the ${f.lesion.inDominantHemisphere ? 'language-dominant' : 'non-dominant'} hemisphere`}.`,
    a
      ? `${f.route.isRecommended ? 'The best corridor' : `You picked ${f.route.label}, which`} goes ${a.approach.charAt(0).toLowerCase() + a.approach.slice(1)}, heading ${a.heading} for ${f1(a.depthMm)} mm to the margin${a.closest[0] ? ` and staying ${f1(a.closest[0].clearanceMm)} mm off the ${a.closest[0].name.toLowerCase()}` : ''}.`
      : `I could not find an acceptable transcortical corridor. ${f.noCorridorReason}`,
    rec ? `The recommended route, ${rec.approach.charAt(0).toLowerCase() + rec.approach.slice(1)}, still has the ${rec.note}.` : '',
    !rec && alt ? `I would not take the next option, ${alt.approach.charAt(0).toLowerCase() + alt.approach.slice(1)}, because ${alt.note}.` : '',
    top ? `The region I would worry about most is the ${top.name.toLowerCase()} (${lc(top.fn)}), ${top.crossed ? 'which the corridor passes through' : top.distanceMm < 1 ? 'which touches the tumor' : `${f1(top.distanceMm)} mm from the tumor`}.` : '',
    `Expect up to ${f1(shift)} mm of shift once the tumor is out, ${shift >= 3 ? 'enough that navigation will drift, so re-register before the deep margin' : 'small enough that navigation should hold, but check it against landmarks'}.`,
  ].filter(Boolean).join(' ');

  const points: string[] = [];
  if (near && near.distanceMm < 1) {
    points.push(`The ${near.name.toLowerCase()} (${lc(near.fn)}) touches the tumor margin, so slow down and confirm the boundary on that side.`);
  } else if (near && near.distanceMm < 10) {
    points.push(`The ${near.name.toLowerCase()} is only ${f1(near.distanceMm)} mm from the margin, so map before you resect toward it.`);
  }
  if (a?.closest[0]) points.push(`The corridor runs ${f1(a.closest[0].clearanceMm)} mm from the ${a.closest[0].name.toLowerCase()}; keep retraction gentle on that side.`);
  if (a && a.depthMm > 20) points.push(`At ${f1(a.depthMm)} mm deep, a tubular retractor will keep the corridor from widening.`);
  if (shift >= 3) points.push(`Tissue moves up to ${f1(shift)} mm toward the cavity, mostly in the ${f.shift.mostStressed[0]?.name.toLowerCase()}.`);
  const dura = f.shift.phases?.[0];
  if (dura && dura.deepMarginShiftMm >= 1) {
    points.push(`Opening the dura alone moves the deep margin about ${f1(dura.deepMarginShiftMm)} mm, so register navigation before you open it.`);
  }
  if (a) points.push(`Position: ${a.positioning.charAt(0).toLowerCase() + a.positioning.slice(1)}.`);

  const movement = f.risks.some((r) => /motor/i.test(r.fn) && r.level !== 'Low');
  const language = f.risks.some((r) => /language/i.test(r.fn) && r.level !== 'Low');

  const where = f.lesion.lobe === 'Brainstem'
    ? 'in the brainstem, the part of the brain that connects to the spinal cord'
    : f.lesion.side === 'midline'
      ? `in the ${f.lesion.lobe.toLowerCase()} lobe, near the middle of your brain`
      : `in the ${f.lesion.lobe.toLowerCase()} lobe on the ${f.lesion.side} side of your brain`;

  return {
    surgeon: { summary, points: points.slice(0, 5) },
    patient: {
      summary: [
        `The tumor sits ${where}, about ${f1(f.lesion.diameterMm / 10)} cm across.`,
        a
          ? `The model found a path to reach it through about ${f1(a.depthMm / 10)} cm of brain while keeping clear of the most important areas.`
          : "Because of where it sits, there isn't a straightforward path through the brain to reach it, so your team will weigh other ways to treat it or take a sample.",
        `If it is removed, the brain around it settles back by about ${f1(shift)} mm, which is a small movement.`,
      ].join(' '),
      points: a
        ? [
            movement
              ? 'The area that controls movement is close, so your team will test it during surgery.'
              : 'The area that controls movement is not on the planned path.',
            language
              ? 'A language area is nearby, so your surgeon may suggest keeping you awake for part of it.'
              : 'The main language areas are not on the planned path.',
            'This is a planning model built from a standard brain, not a diagnosis.',
          ]
        : [
            'Your surgeon may suggest a different kind of operation, or a small sample (biopsy) first.',
            'Specialist teams often plan cases like this together.',
            'This is a planning model built from a standard brain, not a diagnosis.',
          ],
      questions: [
        'Why is this the safest way in for my tumor?',
        'Will you test movement or speech during the operation?',
        'What should I watch for after surgery?',
      ],
    },
  };
}

const strip = (t: string) => t.replace(/\*\*|__|^[-*•]\s*/g, '').trim();

export async function POST(req: NextRequest) {
  try {
    const { facts, query = null, conversation_id = null } = (await req.json()) as {
      facts: ReportFacts; query?: string | null; conversation_id?: string | null;
    };
    if (!facts?.lesion) {
      return NextResponse.json({ error: 'Missing simulation facts' }, { status: 400 });
    }
    const conversationId = conversation_id || crypto.randomUUID();
    const apiKey = process.env.GEMINI_API_KEY || '';

    if (apiKey && apiKey !== 'dummy_key') {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: buildPrompt(facts, query) }] }],
              generationConfig: { temperature: 0.5, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const n = JSON.parse(text) as Narrative;
            return NextResponse.json({
              surgeon: { summary: strip(n.surgeon.summary), points: (n.surgeon.points || []).slice(0, 5).map(strip) },
              patient: {
                summary: strip(n.patient.summary),
                points: (n.patient.points || []).slice(0, 4).map(strip),
                questions: (n.patient.questions || []).slice(0, 3).map(strip),
              },
              source: 'gemini',
              conversation_id: conversationId,
            });
          }
        } else {
          console.error('Gemini returned', response.status, await response.text());
        }
      } catch (geminiErr) {
        console.error('Gemini call failed, using the built-in report:', geminiErr);
      }
    }

    return NextResponse.json({ ...fallbackNarrative(facts), source: 'fallback', conversation_id: conversationId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Report generation failed' }, { status: 500 });
  }
}
