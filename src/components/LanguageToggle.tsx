import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  className?: string;
  variant?: 'default' | 'minimal';
}

export function LanguageToggle({ className, variant = 'default' }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <button
          onClick={() => setLanguage('de')}
          className={cn(
            'px-2 py-1 text-sm font-medium transition-colors rounded',
            language === 'de'
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          DE
        </button>
        <span className="text-muted-foreground">/</span>
        <button
          onClick={() => setLanguage('en')}
          className={cn(
            'px-2 py-1 text-sm font-medium transition-colors rounded',
            language === 'en'
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant={language === 'de' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLanguage('de')}
        className="gap-1"
      >
        🇦🇹 Deutsch
      </Button>
      <Button
        variant={language === 'en' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLanguage('en')}
        className="gap-1"
      >
        🇬🇧 English
      </Button>
    </div>
  );
}
