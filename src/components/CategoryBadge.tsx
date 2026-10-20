import { categoryColor, categoryPath } from '../lib/engine';
import type { Category } from '../lib/types';

export function CategoryBadge({
  categoryId,
  categories,
  emptyLabel = 'Sem categoria',
}: {
  categoryId: string | null;
  categories: Category[];
  emptyLabel?: string;
}) {
  const name =
    categoryPath(categoryId, categories)
      .map((category) => category.name)
      .join(' › ') || emptyLabel;
  return (
    <span className="category-badge" title={name}>
      <i
        className="category-dot"
        style={{ background: categoryColor(categoryId, categories) }}
        aria-hidden="true"
      />
      <span>{name}</span>
    </span>
  );
}
