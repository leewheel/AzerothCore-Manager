import React, { useRef, useEffect } from 'react';
import { LogEntry, LogLevel } from '../types';

interface ConsoleProps {
  logs: LogEntry[];
}

const Console: React.FC<ConsoleProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [logs]);

  return (
    <div className="w-full h-full overflow-y-scroll bg-white font-mono text-[11px] p-1">
      {logs.map((log) => (
        <div key={log.id} className="whitespace-nowrap hover:bg-[#3399ff] hover:text-white cursor-default px-1">
          <span className="inline-block w-16 text-gray-500 group-hover:text-white">{log.timestamp}</span>
          <span className="inline-block w-12 font-bold mr-2">{log.source}</span>
          <span className={log.level === LogLevel.ERROR ? 'text-red-600 group-hover:text-white' : ''}>
            {log.message}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default Console;