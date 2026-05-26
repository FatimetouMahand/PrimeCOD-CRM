import { Card } from "@/components/ui/card";

type StatsCardProps = {
  title: string;
  value: string;
};

export default function StatsCard({
  title,
  value,
}: StatsCardProps) {
  return (
    <Card className="p-6 shadow-sm border-0">
      <h3 className="text-sm text-gray-500">
        {title}
      </h3>

      <p className="mt-3 text-3xl font-bold">
        {value}
      </p>
    </Card>
  );
}