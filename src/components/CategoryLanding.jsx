import React from 'react';
import { Play, Music, ListMusic, Headset, Disc, Disc3, Radio } from 'lucide-react';

export default function CategoryLanding({ spaces, onSelectCategory, setCurrentTab }) {
  // Filter out "All Songs" if we want to display it differently or keep it
  const categories = spaces.filter(s => s !== 'All Songs');

  const handleSelect = (category) => {
    onSelectCategory(category);
    setCurrentTab('library');
  };

  return (
    <div className="category-landing">
      <div className="category-header">
        <h1 className="category-title">What are you in the mood for?</h1>
        <p className="category-subtitle">Select a space to dive into your personalized library</p>
      </div>

      <div className="category-grid">
        {/* Special 'All Songs' Card */}
        <div 
          className="category-card all-songs-card"
          onClick={() => handleSelect('All Songs')}
        >
          <div className="category-icon-bg">
            <ListMusic size={48} />
          </div>
          <div className="category-content">
            <h2>All Songs</h2>
            <p>Your entire collection</p>
          </div>
          <div className="category-play-btn">
            <Play size={24} fill="currentColor" />
          </div>
        </div>

        {/* Dynamic Macro-Genre Cards */}
        {categories.map((category, index) => {
          // Assign dynamic icons based on text
          let Icon = Disc;
          if (category.includes('Bollywood')) Icon = Music;
          else if (category.includes('Pop')) Icon = Radio;
          else if (category.includes('Electronic')) Icon = Headset;
          else if (category.includes('Hip-Hop')) Icon = Disc3;

          return (
            <div 
              key={category} 
              className={`category-card macro-card index-${index % 5}`}
              onClick={() => handleSelect(category)}
            >
              <div className="category-icon-bg">
                <Icon size={48} />
              </div>
              <div className="category-content">
                <h2>{category}</h2>
                <p>Curated space</p>
              </div>
              <div className="category-play-btn">
                <Play size={24} fill="currentColor" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
