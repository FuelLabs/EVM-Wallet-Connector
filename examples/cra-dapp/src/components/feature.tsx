import React from 'react';

type Props = {
  title: string;
} & React.HTMLAttributes<HTMLDivElement>;

export default function Feature(props: Props) {
  const { title, children, ...rest } = props;
  return (
    <div id="account" {...rest}>
      <h3 className="text-sm font-medium dark:text-zinc-300/70">{title}</h3>
      <div className="flex items-center justify-between text-lg dark:text-zinc-50">
        {children}
      </div>
    </div>
  );
}
