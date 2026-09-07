import { useState } from "react";

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="json-tree" role="tree" aria-label="Annotation JSON">
      <JsonNode value={value} depth={0} defaultOpen />
    </div>
  );
}

function JsonNode({
  name,
  value,
  depth,
  defaultOpen,
}: {
  name?: string;
  value: unknown;
  depth: number;
  defaultOpen?: boolean;
}) {
  const collection = collectionInfo(value);
  const [open, setOpen] = useState(defaultOpen ?? depth < 2);

  if (!collection) {
    return (
      <div className="json-row" role="treeitem">
        {name != null ? <span className="json-key">{name}</span> : null}
        {name != null ? <span className="json-colon">: </span> : null}
        <span className={`json-value is-${primitiveKind(value)}`}>
          {formatPrimitive(value)}
        </span>
      </div>
    );
  }

  const entries = collection.entries;
  const preview = collection.kind === "array" ? `[${entries.length}]` : `{${entries.length}}`;

  return (
    <div
      className="json-node"
      role="treeitem"
      aria-expanded={open}
    >
      <button
        type="button"
        className="json-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={open ? "json-chevron is-open" : "json-chevron"} aria-hidden>
          ▶
        </span>
        {name != null ? <span className="json-key">{name}</span> : null}
        {name != null ? <span className="json-colon">: </span> : null}
        <span className="json-preview">
          {open ? (collection.kind === "array" ? "[" : "{") : preview}
        </span>
      </button>
      {open ? (
        <div className="json-children" role="group">
          {entries.map(([key, child]) => (
            <JsonNode
              key={nodeKey(key, child)}
              name={key}
              value={child}
              depth={depth + 1}
              defaultOpen={depth + 1 < 2}
            />
          ))}
          <div className="json-row json-close" aria-hidden>
            {collection.kind === "array" ? "]" : "}"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function collectionInfo(value: unknown): {
  kind: "array" | "object";
  entries: Array<[string, unknown]>;
} | null {
  if (Array.isArray(value)) {
    return {
      kind: "array",
      entries: value.map((item, index) => [String(index), item]),
    };
  }
  if (value && typeof value === "object") {
    return {
      kind: "object",
      entries: Object.entries(value as Record<string, unknown>),
    };
  }
  return null;
}

function nodeKey(key: string, value: unknown) {
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") {
      return `${key}:${id}`;
    }
  }
  return key;
}

function primitiveKind(value: unknown) {
  if (value === null) return "null";
  return typeof value;
}

function formatPrimitive(value: unknown) {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  return String(value);
}
