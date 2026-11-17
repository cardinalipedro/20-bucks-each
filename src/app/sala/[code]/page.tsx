import { RoomPage } from '@/presentation/components/room/RoomPage';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <main>
      <RoomPage code={code.toUpperCase()} />
    </main>
  );
}
