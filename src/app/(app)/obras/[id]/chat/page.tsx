import ChatObra from "@/components/ChatObra";

export default function ObraChatPage({ params }: { params: { id: string } }) {
  return <ChatObra obraId={params.id} />;
}
