import React from 'react';
import { ServiceStatus } from '../types';

interface StatusCardProps {
  name: string;
  status: ServiceStatus;
  simple?: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({ name, status, simple }) => {
  const getStatusColor = () => {
    switch(status) {
      case ServiceStatus.RUNNING: return 'text-green-700';
      case ServiceStatus.ERROR: return 'text-red-700';
      case ServiceStatus.STARTING: return 'text-yellow-700';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex justify-between items-center bg-white border border-[#d9d9d9] px-2 py-1">
      <span className="text-black">{name}:</span>
      <span className={`font-bold ${getStatusColor()}`}>
        {status}
      </span>
    </div>
  );
};

export default StatusCard;