import React from 'react';
import { ValueRating } from '@/lib/types';
import { Badge } from './Badge';
import { ShieldCheck, ThumbsUp, HelpCircle, Scissors } from 'lucide-react';

export function ValueRatingTag({ rating, size = 'sm' }: { rating: ValueRating; size?: 'sm' | 'md' }) {
  switch (rating) {
    case 'essential':
      return (
        <Badge variant="primary" size={size}>
          <ShieldCheck className="w-3 h-3" />
          Essential
        </Badge>
      );
    case 'useful':
      return (
        <Badge variant="default" size={size}>
          <ThumbsUp className="w-3 h-3" />
          Useful
        </Badge>
      );
    case 'rarely_used':
      return (
        <Badge variant="warning" size={size}>
          <HelpCircle className="w-3 h-3" />
          Rarely used
        </Badge>
      );
    case 'cancel_candidate':
      return (
        <Badge variant="danger" size={size}>
          <Scissors className="w-3 h-3" />
          Cancel candidate
        </Badge>
      );
    default:
      return null;
  }
}
