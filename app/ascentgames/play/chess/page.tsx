import AscentPlayFrame from "@/components/AscentPlayFrame";

export const metadata = {
  title: "Play Chess Ascent",
  description: "Play Chess Ascent in the browser.",
};

export default function Page() {
  return (
    <div className="ascent-play">
      <div className="ascent-play-stage">
        <AscentPlayFrame />
      </div>
    </div>
  );
}
