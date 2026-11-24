const products={
  taima:{title:'Taima’s Original Pepper',type:'BILTONG / THE ORIGINAL',description:'Peppery, savoury biltong slices. The familiar one you reach for first.',image:'/assets/taima-original-pepper.webp',alt:'Slices of original pepper biltong'},
  malome:{title:'Malome’s Chillie Bites',type:'CHILLI BITES / THE BOLD ONE',description:'Dark, seasoned chilli bites with a proper chew and a chilli kick.',image:'/assets/malome-chilli-bites.webp',alt:'Chilli bites in a bowl'},
  oulady:{title:'OuLady’s Droëwors',type:'DROËWORS / THE CLASSIC',description:'Dried sausage sticks, ready for a quick snack or a long catch-up.',image:'/assets/oulady-droewors.webp',alt:'Droëwors sticks in a bowl'}
};
const menuButton=document.querySelector('#menu-toggle');const mobileNav=document.querySelector('#mobile-nav');
function closeMenu(){menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open menu');mobileNav.hidden=true}
menuButton.addEventListener('click',()=>{const opening=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(opening));menuButton.setAttribute('aria-label',opening?'Close menu':'Open menu');mobileNav.hidden=!opening});
mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
const dialog=document.querySelector('#product-dialog');const toast=document.querySelector('#toast');let activeProduct='';let toastTimer;
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}
function openProduct(id,push=true){const p=products[id];if(!p)return;activeProduct=id;document.querySelector('#dialog-title').textContent=p.title;document.querySelector('#dialog-type').textContent=p.type;document.querySelector('#dialog-description').textContent=p.description;const image=document.querySelector('#dialog-image');image.src=p.image;image.alt=p.alt;if(!dialog.open)dialog.showModal();if(push&&location.hash!=='#'+id)history.pushState({},'',`#${id}`)}
document.querySelectorAll('[data-product]').forEach(button=>button.addEventListener('click',()=>openProduct(button.dataset.product)));
document.querySelector('#dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
function share(title,url){if(navigator.share){navigator.share({title,url}).catch(()=>{});return}if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>showToast('Link copied to clipboard')).catch(()=>showToast('Copy the link from your browser'))}else showToast('Copy the link from your browser')}
document.querySelector('#share-product').addEventListener('click',()=>share(products[activeProduct].title,`${location.origin}${location.pathname}#${activeProduct}`));
document.querySelector('#share-site').addEventListener('click',()=>share('KASI CUT',location.origin+location.pathname));
document.querySelector('#year').textContent=new Date().getFullYear();
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(products[id])openProduct(id,false);else if(dialog.open)dialog.close()});
if(products[location.hash.slice(1)])openProduct(location.hash.slice(1),false);
