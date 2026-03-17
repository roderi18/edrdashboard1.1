import { useEffect } from 'react';

export function useBorderPulse() {
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById('border-pulse-keyframes')) return;

        const style = document.createElement('style');
        style.id = 'border-pulse-keyframes';
        style.innerHTML = `
      @keyframes borderPulseTwice {
        0%   { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
        25%  { box-shadow: 0 0 0 3px rgba(25,118,210, 1); }
        50%  { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
        75%  { box-shadow: 0 0 0 3px rgba(25,118,210, 1); }
        100% { box-shadow: 0 0 0 0 rgba(25,118,210, 0); }
      }
    `;
        document.head.appendChild(style);
    }, []);
}
