export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="font-serif text-4xl leading-none">Dusan OS</p>
          <p className="mt-2 text-sm text-muted-foreground">Work, money, study and health — one place, five minutes a day.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
