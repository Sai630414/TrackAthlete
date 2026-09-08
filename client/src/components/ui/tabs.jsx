import * as React from "react"
import { cva } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("flex flex-col gap-4 w-full", className)}
      {...props} />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}) {
  return (
    <div className="w-full max-w-full overflow-x-auto scrollbar-none rounded-xl" style={{ WebkitOverflowScrolling: 'touch' }}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn("flex flex-nowrap w-max min-w-full min-h-11 items-center justify-start rounded-xl bg-[#e2eee4] p-1 border border-[#2f6d5a]/30 text-[#526668] gap-1", className)}
        {...props} />
    </div>
  );
}

function TabsTrigger({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap flex-shrink-0 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all outline-none text-[#526668] hover:text-[#173235] data-[state=active]:bg-white data-[state=active]:text-[#194e42] data-[state=active]:shadow-sm cursor-pointer",
        className
      )}
      {...props} />
  );
}

function TabsContent({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props} />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
