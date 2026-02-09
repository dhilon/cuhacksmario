import React from 'react';
import { useLevelCompletion } from '../context/LevelCompletionContext';

const LevelFooter: React.FC = () => {
  const { completedLevels, completedCount, totalLevels, isLevelComplete } = useLevelCompletion();

  return (
    <div style={{
      marginTop: '20px',
      padding: '15px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
    }}>
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {Array.from({ length: totalLevels }, (_, i) => i + 1).map((level) => {
          const completed = isLevelComplete(level);
          return (
            <div
              key={level}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: completed ? '#4ade80' : 'rgba(255, 255, 255, 0.1)',
                color: completed ? '#000' : '#666',
                border: completed ? '2px solid #22c55e' : '2px solid #333',
                transition: 'all 0.3s ease',
              }}
            >
              {level}
            </div>
          );
        })}
      </div>
      <div style={{
        color: '#aaa',
        fontSize: '14px',
        fontWeight: 'bold',
      }}>
        {completedCount}/{totalLevels} completed
      </div>
    </div>
  );
};

export default LevelFooter;
