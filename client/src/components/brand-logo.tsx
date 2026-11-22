import {brandAssets, type Brand} from '@/lib/brand-assets';

const sizes = {
  header: 'w-[140px] sm:w-[205px]',
  hero: 'w-[280px] sm:w-[380px]',
  card: 'w-[230px]',
  footer: 'w-[240px]',
};

export function BrandLogo({brand,theme='light',size='header',priority=false,className=''}:{
  brand:Brand;theme?:'light'|'dark';size?:keyof typeof sizes;priority?:boolean;className?:string;
}){
 const asset=brandAssets[brand];
 return <img src={`/brands/${brand}${theme==='dark'?'-on-dark':''}.svg`}
   alt={asset.name} width={asset.width} height={asset.height}
   loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined}
   className={`block h-auto max-w-full shrink-0 object-contain ${sizes[size]} ${className}`}
   data-brand={brand} />;
}
