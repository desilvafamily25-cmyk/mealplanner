import Link from 'next/link';

export default function Page() {
  return (
    <div className="card">
      <h1>Meal Planner</h1>
      <p className="mb-4">Browse recipes, plan the week, and generate a shopping list.</p>
      <div className="flex gap-3">
        <Link className="btn-primary btn" href="/recipes">View recipes</Link>
        <Link className="btn" href="/lunch">Lunch mains</Link>
        <Link className="btn" href="/plan">Meal plan</Link>
      </div>
    </div>
  );
}
