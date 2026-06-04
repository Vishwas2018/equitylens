import { redirect } from 'next/navigation';

// Properties index — handled by the Portfolio overview (Day 9). Direct link redirects there.
export default function PropertiesPage() {
  redirect('/portfolio');
}
