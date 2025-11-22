import React, { useState } from 'react';
import { AccountFormData } from '../types';

interface RegistrationFormProps {
  isConnected: boolean;
  onRegister: (data: AccountFormData) => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ isConnected, onRegister }) => {
  const [formData, setFormData] = useState<AccountFormData>({
    username: '',
    password: '',
    gmLevel: 0,
    expansion: 2
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) return;
    onRegister(formData);
    setFormData(prev => ({ ...prev, username: '', password: '' }));
  };

  return (
    <div className="win-groupbox h-full">
      <span className="win-groupbox-label">Create Account (MySQL)</span>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
        <div className="flex items-center gap-2">
           <label className="w-20 text-right text-xs">Username:</label>
           <input 
             type="text" 
             className="win-input flex-1 uppercase"
             value={formData.username}
             onChange={e => setFormData({...formData, username: e.target.value.toUpperCase()})}
             disabled={!isConnected}
           />
        </div>
        
        <div className="flex items-center gap-2">
           <label className="w-20 text-right text-xs">Password:</label>
           <input 
             type="password" 
             className="win-input flex-1"
             value={formData.password}
             onChange={e => setFormData({...formData, password: e.target.value})}
             disabled={!isConnected}
           />
        </div>

        <div className="flex gap-4">
            <div className="flex items-center gap-2 flex-1">
               <label className="w-20 text-right text-xs">Access:</label>
               <select 
                 className="win-input flex-1"
                 value={formData.gmLevel}
                 onChange={e => setFormData({...formData, gmLevel: Number(e.target.value)})}
                 disabled={!isConnected}
               >
                 <option value={0}>Player</option>
                 <option value={1}>GM L1</option>
                 <option value={2}>GM L2</option>
                 <option value={3}>Admin</option>
               </select>
            </div>
        </div>
        
        <div className="flex items-center gap-2 flex-1">
           <label className="w-20 text-right text-xs">Expansion:</label>
           <select 
             className="win-input flex-1"
             value={formData.expansion}
             onChange={e => setFormData({...formData, expansion: Number(e.target.value)})}
             disabled={!isConnected}
           >
             <option value={2}>Wrath of the Lich King</option>
             <option value={1}>The Burning Crusade</option>
             <option value={0}>Classic</option>
           </select>
        </div>

        <div className="flex justify-end mt-2">
           <button 
             type="submit" 
             disabled={!isConnected}
             className="win-btn px-6 py-1 disabled:opacity-50"
           >
             Register Account
           </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;