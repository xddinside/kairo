export type SampleFile = {
  id: string;
  name: string;
  kind: "markdown";
  course: string;
  size: string;
  updated: string;
  body: string;
};

export const sampleFiles: SampleFile[] = [
  {
    id: "ainn-backprop",
    name: "AINN — Backpropagation worked examples",
    kind: "markdown",
    course: "AI & Neural Networks",
    size: "12 KB",
    updated: "Yesterday",
    body: `# Backpropagation: worked examples

Lecture 6 · AI & Neural Networks

## One training step, concretely

Take a two-layer network with one hidden unit:

1. Forward pass — compute activations from the input.
2. Loss — squared error between output and target.
3. Backward pass — propagate the gradient through each weight.
4. Update — step every weight against its gradient.

## The chain rule is the whole trick

The error at the output flows back through the product of local gradients:

- the hidden layer gradient is the output gradient times the weight that connected them;
- the input weight gradient is the hidden activation times the hidden gradient.

## Where the quiz usually goes wrong

- Forgetting the activation derivative (sigmoid derivative is a(1−a), not 1).
- Mixing up which weight connects to which node when the network has two hidden layers.
- Dropping the 2 from the squared-error derivative.

## Worked example: single unit

Input x = 2, target y = 1, weight w = 0.5, activation = sigmoid(wx).

- forward: z = 1.0, a = σ(1.0) ≈ 0.731
- loss: (0.731 − 1)² = 0.072
- gradient of loss w.r.t. a: 2(a − y) ≈ −0.538
- gradient w.r.t. z: −0.538 · a(1−a) ≈ −0.106
- gradient w.r.t. w: −0.106 · x ≈ −0.212
- update with step 0.1: w = 0.5 + 0.0212 ≈ 0.521

## Quiz questions to practice

1. Compute one update for a two-input, one-output network by hand.
2. Write the gradient of the squared error with respect to the bias.
3. Show that a linear network collapses to a single layer.`,
  },
  {
    id: "toc-pumping",
    name: "TOC — Pumping lemma checklist",
    kind: "markdown",
    course: "Theory of Computation",
    size: "9 KB",
    updated: "2 days ago",
    body: `# Pumping lemma checklist

Tutorial 3 · Theory of Computation

## The template

To prove a language is not regular:

1. Assume it is regular; then the pumping lemma applies.
2. Pick a string s from the language, with |s| ≥ p.
3. Every split s = xyz with |xy| ≤ p and |y| ≥ 1 must fail:
   find the contradiction for xy²z ∉ L.
4. Conclude the assumption was wrong.

## Choosing the string

- Make the count depend on p, never on a fixed number.
- Prefer a string where pumping a single block breaks the structure.
- If the language has two equal-length halves, pump the first half.

## Questions 4 and 5

Question 4 is a pure pumping proof. Question 5 mixes pumping with a closure argument:

- if L is regular, its complement is regular;
- choose the complement so that pumping becomes easy;
- derive the contradiction there.`,
  },
];

export function renderMarkdown(body: string): React.ReactNode[] {
  const lines = body.split("\n");
  const nodes: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = (key: string) => {
    if (paragraph.length === 0) return;
    nodes.push(
      <p key={key} className="text-[15px] leading-7 text-kumo-default">
        {paragraph.join(" ")}
      </p>,
    );
    paragraph = [];
  };

  const flushList = (key: string) => {
    if (!list) return;
    nodes.push(
      list.ordered ? (
        <ol
          key={key}
          className="grid gap-1.5 ps-5 text-[15px] leading-7 text-kumo-default [&>li]:list-decimal marker:text-kumo-subtle"
        >
          {list.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul
          key={key}
          className="grid gap-1.5 ps-5 text-[15px] leading-7 text-kumo-default [&>li]:list-disc marker:text-kumo-subtle"
        >
          {list.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  lines.forEach((line, index) => {
    const key = `l${index}`;
    if (line.trim() === "") {
      flushParagraph(key);
      flushList(key);
      return;
    }
    if (line.startsWith("# ")) {
      flushParagraph(key);
      flushList(key);
      nodes.push(
        <h2 key={key} className="mt-2 text-2xl font-semibold tracking-tight text-kumo-strong">
          {line.slice(2)}
        </h2>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      flushParagraph(key);
      flushList(key);
      nodes.push(
        <h3 key={key} className="mt-6 text-lg font-semibold text-kumo-default">
          {line.slice(3)}
        </h3>,
      );
      return;
    }
    const orderedMatch = /^\d+\.\s+(.*)$/.exec(line);
    if (orderedMatch) {
      flushParagraph(key);
      if (!list || !list.ordered) {
        flushList(key);
        list = { ordered: true, items: [] };
      }
      list.items.push(orderedMatch[1]);
      return;
    }
    if (line.startsWith("- ")) {
      flushParagraph(key);
      if (!list || list.ordered) {
        flushList(key);
        list = { ordered: false, items: [] };
      }
      list.items.push(line.slice(2));
      return;
    }
    if (line.startsWith("> ")) {
      flushParagraph(key);
      flushList(key);
      nodes.push(
        <p
          key={key}
          className="rounded-lg border-s-2 border-kumo-brand bg-kumo-tint px-4 py-2 text-[15px] leading-7 text-kumo-default"
        >
          {line.slice(2)}
        </p>,
      );
      return;
    }
    flushList(key);
    paragraph.push(line);
  });
  flushParagraph("last");
  flushList("last");
  return nodes;
}
