import {
  DEFAULT_STROKE_WIDTH,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  fontPickerOptions,
  isArrowAnnotation,
  useAnnotateFonts,
  useAnnotateItems,
} from "@orange-groove/react-map-annotate/mapbox";

export function CustomList() {
  const items = useAnnotateItems();
  const fonts = useAnnotateFonts();

  return (
    <div className="custom-list">
      <div className="custom-list-heading">Custom list</div>
      {items.length === 0 ? (
        <p className="custom-list-empty">No annotations</p>
      ) : (
        <ul className="custom-list-items" aria-label="Custom annotations">
          {items.map((item) => {
            const fontOptions = fontPickerOptions(fonts, item.fontFamily);
            return (
              <li
                key={item.id}
                className={
                  item.isSelected
                    ? "custom-list-item is-selected"
                    : "custom-list-item"
                }
                aria-selected={item.isSelected}
                onPointerDown={item.select}
              >
                <span className="custom-list-kind">{item.kindLabel}</span>
                <input
                  type="color"
                  className="custom-list-color"
                  value={item.color}
                  aria-label={`Color for ${item.label || item.kindLabel}`}
                  title="Color"
                  onChange={(event) => item.setColor(event.target.value)}
                />
                <input
                  className="custom-list-label"
                  value={item.label}
                  aria-label={`Label for ${item.kindLabel}`}
                  onChange={(event) => item.setLabel(event.target.value)}
                />
                <button
                  type="button"
                  className="custom-list-delete"
                  aria-label={`Delete ${item.label || item.kindLabel}`}
                  title="Delete"
                  onClick={item.remove}
                >
                  ×
                </button>
                {item.kind === "text" ? (
                  <select
                    className="custom-list-font"
                    value={item.fontFamily ?? ""}
                    aria-label={`Font for ${item.label || item.kindLabel}`}
                    onChange={(event) =>
                      item.setStyle({
                        fontFamily: event.target.value || undefined,
                      })
                    }
                  >
                    {fontOptions.map((option) => (
                      <option
                        key={option.family || "system"}
                        value={option.family}
                      >
                        {option.label ?? option.family}
                      </option>
                    ))}
                  </select>
                ) : null}
                {isArrowAnnotation(item.annotation) ? (
                  <input
                    type="range"
                    className="custom-list-size"
                    min={MIN_STROKE_WIDTH}
                    max={MAX_STROKE_WIDTH}
                    step={1}
                    value={
                      item.annotation.style?.strokeWidth ?? DEFAULT_STROKE_WIDTH
                    }
                    aria-label={`Size for ${item.label || item.kindLabel}`}
                    title="Size"
                    onChange={(event) =>
                      item.setStyle({
                        strokeWidth: Number(event.target.value),
                      })
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
