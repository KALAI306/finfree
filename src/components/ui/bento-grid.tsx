import { cn } from "../../lib/utils";

export interface BentoItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  status?: string;
  tags?: string[];
  meta?: string;
  cta?: string;
  colSpan?: number;
  hasPersistentHover?: boolean;
}

interface BentoGridProps {
  items: BentoItem[];
  className?: string;
}

function BentoGrid({ items, className }: BentoGridProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-3", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "group relative p-4 rounded-xl overflow-hidden transition-all duration-300",
            "border border-white/8 bg-card/60 backdrop-blur-sm",
            "hover:shadow-[0_2px_20px_rgba(0,0,0,0.3)] hover:border-primary/20",
            "hover:-translate-y-0.5 will-change-transform cursor-pointer",
            item.colSpan === 2 ? "md:col-span-2" : "col-span-1",
            {
              "shadow-[0_2px_20px_rgba(0,0,0,0.3)] -translate-y-0.5 border-primary/20": item.hasPersistentHover,
            }
          )}
        >
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-300",
              item.hasPersistentHover ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px]" />
          </div>

          <div className="relative flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                "bg-primary/10 group-hover:bg-primary/20"
              )}>
                {item.icon}
              </div>
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-lg",
                "bg-primary/8 text-muted-foreground border border-primary/10",
                "transition-colors duration-300 group-hover:bg-primary/15 group-hover:text-foreground"
              )}>
                {item.status || "Active"}
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-medium text-foreground tracking-tight text-[15px]">
                {item.title}
                {item.meta && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">{item.meta}</span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground leading-snug">{item.description}</p>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                {item.tags?.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-primary/8 text-muted-foreground text-xs border border-primary/10 transition-all duration-200 hover:bg-primary/15 hover:text-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {item.cta || "View →"}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "absolute inset-0 -z-10 rounded-xl p-px bg-gradient-to-br from-transparent via-primary/8 to-transparent transition-opacity duration-300",
              item.hasPersistentHover ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          />
        </div>
      ))}
    </div>
  );
}

export { BentoGrid };
