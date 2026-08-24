import TopBar from "@/components/TopBar";

export default function EmConstrucao({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <TopBar title={title} subtitle={subtitle} />
      <div className="p-8">
        <div className="rounded-xl border border-dashed border-ink-800 p-10 text-center">
          <p className="text-sm text-neutral-600">Módulo em construção — próxima fase do sistema.</p>
        </div>
      </div>
    </div>
  );
}
