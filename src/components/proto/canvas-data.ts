import { BookOpen, CalendarBlank, ListChecks } from "@phosphor-icons/react";

export const contextSummary = {
  courses: "4 courses",
  openTasks: "8 open tasks",
  overdue: "1 overdue",
  next: "Next: AINN at 9:00 AM",
};

export const demoPrompt =
  "What should I work on right now? Give me 2–3 things.";

export const quietSuggestions = [
  { text: demoPrompt, icon: ListChecks },
  { text: "Plan my AINN quiz prep", icon: BookOpen },
  { text: "What can wait until Friday?", icon: CalendarBlank },
];

export type PlanItem = {
  timing: "Now" | "Next" | "Later";
  title: string;
  course: string;
  duration: string;
  when?: string;
  window: string;
  context: string;
  signals: string[];
  reason: string;
  overdue?: boolean;
  note?: string;
};

export const planItems: [PlanItem, PlanItem, PlanItem] = [
  {
    timing: "Now",
    title: "Review backpropagation examples",
    course: "AI & Neural Networks",
    duration: "45 min",
    window: "8:00–8:45 AM",
    context: "Before AINN at 9:00 AM",
    signals: ["Weakest topic", "Quiz Wednesday", "Fits before class"],
    reason:
      "The quiz is Wednesday, this is your weakest topic, and it fits before your 9:00 AM class.",
    note: "Backpropagation mistakes",
  },
  {
    timing: "Next",
    title: "Finish TOC Tutorial 3",
    course: "Theory of Computation",
    duration: "60 min",
    when: "12:30 PM",
    window: "12:30–1:30 PM",
    context: "Questions 4–5 left",
    signals: ["3 of 5 done", "Only overdue work"],
    reason: "It is your only overdue work.",
    overdue: true,
    note: "Pumping lemma checklist",
  },
  {
    timing: "Later",
    title: "Finish the Software Engineering planning flow",
    course: "Software Engineering",
    duration: "90 min",
    when: "4:30 PM",
    window: "4:30–6:00 PM",
    context: "Checkpoint Thursday at 6:00 PM",
    signals: ["55% complete"],
    reason: "The team checkpoint is Thursday at 6:00 PM.",
    note: "Prototype checkpoint feedback",
  },
];

export const todayClasses = [
  { time: "9:00–10:00 AM", name: "AI & Neural Networks" },
  { time: "11:00 AM–12:00 PM", name: "Theory of Computation" },
  { time: "2:00–4:00 PM", name: "Software Engineering lab" },
];

export const studyWindows = ["8:00–8:50 AM", "12:30–1:30 PM", "4:30–6:00 PM"];

export const linkedNotes = [
  {
    title: "Backpropagation mistakes",
    preview:
      "Keeps losing the chain rule at the hidden layer; examples 3 and 4 need another pass.",
  },
  {
    title: "Pumping lemma checklist",
    preview:
      "Choose the string, test every valid split, then show the contradiction.",
  },
  {
    title: "Prototype checkpoint feedback",
    preview:
      "The lecturer wants one working path and a clear demo, not polished slides.",
  },
];
