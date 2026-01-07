import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>MCMP MVP</h1>
      <p>Choose an action:</p>
      <ul>
        <li><Link href="/signup">Sign up</Link></li>
        <li><Link href="/login">Log in</Link></li>
        <li><Link href="/me">My account</Link></li>
      </ul>
    </main>
  );
}
