import { Plus_Jakarta_Sans, Lora, JetBrains_Mono } from 'next/font/google';
import '../index.css';

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Axonive · Brain shift simulation for neurosurgical planning',
  description: 'Predict tissue deformation and stress distribution in 3D brain resections before you operate.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${lora.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased bg-paper text-fg">
        {children}
      </body>
    </html>
  );
}
