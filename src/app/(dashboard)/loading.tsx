import React from 'react';

// Same frame as DashboardClient (title row, statement, side column) so nothing jumps on load.
export default function DashboardLoading() {
  return (
    <div className="animate-in fade-in duration-100" aria-busy="true" aria-label="Loading overview">
      <div className="hidden sm:flex items-end justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="h-7 w-36 sweep-skeleton" />
          <div className="h-4 w-48 sweep-skeleton" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-36 sweep-skeleton" />
          <div className="h-8 w-36 sweep-skeleton" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
        <div className="paper-sheet lg:col-span-7">
          <div className="paper px-5 sm:px-8 pt-10 pb-10">
            <div className="flex flex-col items-center gap-2">
              <div className="h-3 w-40 sweep-skeleton" />
              <div className="h-3 w-52 sweep-skeleton" />
            </div>
            <div className="rule-dashed my-4" />
            <div className="flex flex-col items-center gap-3">
              <div className="h-3 w-48 sweep-skeleton" />
              <div className="h-[3.25rem] w-48 sweep-skeleton" />
              <div className="h-3 w-24 sweep-skeleton" />
            </div>
            <div className="rule-double mt-5 mb-2" />
            <div className="space-y-4 pt-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 w-40 sweep-skeleton" />
                  <div className="h-3 w-28 sweep-skeleton" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-1 gap-4 lg:col-span-5">
          {[3, 2, 3].map((rows, i) => (
            <div key={i} className="sweep-card p-5 space-y-4">
              <div className="h-5 w-36 sweep-skeleton" />
              <div className="space-y-3">
                {Array.from({ length: rows }, (_, j) => (
                  <div key={j} className="h-4 w-full sweep-skeleton" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
