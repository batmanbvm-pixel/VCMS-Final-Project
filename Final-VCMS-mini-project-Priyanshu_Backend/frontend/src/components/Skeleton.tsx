import { Card, CardContent } from "@/components/ui/card";

export const SkeletonCard = () => (
  <Card>
    <CardContent className="pt-6">
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded-md w-3/4 animate-pulse" />
        <div className="h-4 bg-muted rounded-md w-full animate-pulse" />
        <div className="h-4 bg-muted rounded-md w-2/3 animate-pulse" />
      </div>
    </CardContent>
  </Card>
);

export const SkeletonLine = ({ width = "w-full" }: { width?: string }) => (
  <div className={`h-4 bg-muted rounded-md ${width} animate-pulse`} />
);

export default SkeletonCard;
