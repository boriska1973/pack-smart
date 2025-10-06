/*
  app.js - client-side packing generator logic
  - Generates a packing list based on form inputs
  - Offers save / print / copy share link
  - Includes animated "thinking" suitcase while generating
*/

(function(){
  // Utilities
  function daysBetween(a,b){
    const one = new Date(a);
    const two = new Date(b);
    const diff = Math.ceil((two - one) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 1);
  }

  function el(id){ return document.getElementById(id) }

  // Data templates for items with estimated weights (simple)
  const ITEM_DB = {
    tops: { name:['T-shirt','Long sleeve shirt','Shirt / blouse'], weight:0.25 },
    bottoms: { name:['Jeans','Trousers','Shorts'], weight:0.6 },
    underwear: { name:['Underwear'], weight:0.05 },
    socks: { name:['Socks'], weight:0.04 },
    shoes: { name:['Sneakers','Sandals','Hiking boots'], weight:0.9 },
    jacket: { name:['Light Jacket','Rain Jacket'], weight:0.7 },
    swim: { name:['Swimsuit'], weight:0.15 },
    pajamas: { name:['Pajamas'], weight:0.2 },
    toiletries: { name:['Toiletry kit'], weight:0.6 },
    electronics: { name:['Phone charger','Camera charger'], weight:0.2 },
    documents: { name:['Passport / ID','Tickets'], weight:0.05 },
    camping: { name:['Tent','Sleeping bag'], weight:2.5 },
    cameraGear: { name:['Camera','Lenses'], weight:1.2 },
    medical: { name:['Basic meds','Plasters'], weight:0.1 },
    business: { name:['Business outfit','Belt'], weight:0.8 },
  };

  // Form and UI elements
  const form = el('pack-form');
  const generateBtn = el('generate');
  const resultArea = el('result-area');
  const emptyState = el('empty-state');
  const packingListEl = el('packing-list');
  const listTitle = el('list-title');
  const listMeta = el('list-meta');
  const estCount = el('est-count');
  const estWeight = el('est-weight');
  const saveListBtn = el('save-list');
  const printBtn = el('print-list');
  const copyBtn = el('copy-json');
  const savedListsEl = el('saved-lists');

  // show "thinking" animation by toggling class on small suitcase
  function showThinking(state=true){
    const suitcase = document.querySelector('.suitcase');
    if(!suitcase) return;
    if(state){
      suitcase.classList.add('thinking');
      // CSS rotate animation
      suitcase.style.transition = 'transform .4s';
      suitcase.animate([{transform:'rotate(0deg)'},{transform:'rotate(-6deg)'},{transform:'rotate(6deg)'},{transform:'rotate(0deg)'}], {duration:1200, iterations:2});
    } else {
      suitcase.classList.remove('thinking');
    }
  }

  // packing algorithm (a reasonable, simple heuristic)
  function generatePacking(data){
    const days = daysBetween(data.from, data.to);
    const activities = data.activities || [];
    const style = data.style;
    const luggage = data.luggage;

    const list = [];
    // base items
    const tops = Math.max(1, Math.ceil(days / (style === 'minimal' ? 3 : style === 'balanced' ? 2 : 1)));
    for(let i=0;i<tops;i++){
      list.push({ key:'tops', label: ITEM_DB.tops.name[0] + (tops>1 ? ` (${i+1})` : ''), weight: ITEM_DB.tops.weight });
    }
    // bottoms
    const bottoms = Math.max(1, Math.ceil(days / 3));
    for(let i=0;i<bottoms;i++){
      list.push({ key:'bottoms', label: ITEM_DB.bottoms.name[0] + (bottoms>1? ` (${i+1})` : ''), weight: ITEM_DB.bottoms.weight });
    }
    // underwear & socks & pajamas
    for(let i=0;i<days;i++){
      list.push({ key:'underwear', label: `Underwear (${i+1})`, weight: ITEM_DB.underwear.weight });
      list.push({ key:'socks', label: `Socks (${i+1})`, weight: ITEM_DB.socks.weight });
    }
    list.push({ key:'pajamas', label: ITEM_DB.pajamas.name[0], weight: ITEM_DB.pajamas.weight });

    // shoes
    if(activities.includes('hiking')){
      list.push({ key:'shoes', label: 'Hiking boots', weight: 1.2 });
      // outdoor extras
      list.push({ key:'medical', label: 'Basic first aid kit', weight: ITEM_DB.medical.weight });
    } else if(activities.includes('beach')){
      list.push({ key:'shoes', label: 'Sandals', weight: 0.4 });
      list.push({ key:'swim', label: ITEM_DB.swim.name[0], weight: ITEM_DB.swim.weight });
    } else {
      list.push({ key:'shoes', label: 'Sneakers', weight: ITEM_DB.shoes.weight });
    }

    // activity-specific items
    if(activities.includes('photography')) list.push({ key:'camera', label: 'Camera & batteries', weight: 1.0 });
    if(activities.includes('camping')) list.push({ key:'camping', label: 'Sleeping bag & tent', weight: 3.2 });
    if(activities.includes('business')) {
      list.push({ key:'business', label: 'Business outfit (suit or smart clothes)', weight: ITEM_DB.business.weight });
      list.push({ key:'documents', label: 'Business documents / laptop', weight: 1.2 });
    }

    // toiletries & electronics & documents
    list.push({ key:'toiletries', label: ITEM_DB.toiletries.name[0], weight: ITEM_DB.toiletries.weight });
    list.push({ key:'electro', label: 'Phone charger & adapters', weight: ITEM_DB.electronics.weight });
    list.push({ key:'docs', label: 'Passport / ID / Tickets', weight: ITEM_DB.documents.weight });

    // adjust based on travel style & luggage constraints
    if(luggage === 'carry-on' && style === 'minimal') {
      // drop duplicates where possible
      // reduce some heavier items
      return trimForCarryOn(list, 8.5);
    } else if (luggage === 'carry-on') {
      return trimForCarryOn(list, 10.5);
    } else if (luggage === 'backpack') {
      return trimForCarryOn(list, 12.5);
    } else {
      return list;
    }
  }

  function trimForCarryOn(list, targetKg){
    // simple greedy remove heaviest non-essential items until under target
    let total = list.reduce((s,i)=>s+(i.weight||0), 0);
    const prioritizedKeys = ['docs','electro','toiletries','underwear','tops','bottoms','socks','pajamas','shoes'];
    if(total <= targetKg) return list;
    // remove non-priority items first
    const mutable = [...list];
    // sort by weight descending, but keep priority items protected
    mutable.sort((a,b) => (b.weight||0)-(a.weight||0));
    for(let i=0;i<mutable.length && total>targetKg;i++){
      const item = mutable[i];
      if(!prioritizedKeys.some(k => item.key && item.key.indexOf(k) !== -1) && item.key !== 'docs' && item.key !== 'toiletries'){
        total -= (item.weight||0);
        item.removed = true;
      }
    }
    return mutable.filter(it => !it.removed);
  }

  // render list to DOM with subtle animations
  function renderPacking(data, items){
    packingListEl.innerHTML = '';
    listTitle.textContent = `${data.destination || 'Trip'} — ${data.from} → ${data.to}`;
    listMeta.textContent = `${daysBetween(data.from,data.to)} day(s) · ${data.activities.length?data.activities.join(', '):'No activities specified'} · ${data.luggage} · ${data.style}`;
    let totalWeight = 0;
    items.forEach((it, idx) => {
      totalWeight += (it.weight||0);
      const li = document.createElement('li');
      li.style.opacity = 0;
      li.innerHTML = `<div class="item-left"><div class="dot">${idx+1}</div><div><strong>${it.label}</strong><div class="small">${(it.weight||0).toFixed(2)} kg</div></div></div><div class="badge">${(it.weight||0).toFixed(2)} kg</div>`;
      packingListEl.appendChild(li);
      // animate each entry in
      setTimeout(()=>{ li.style.transition='opacity .6s ease, transform .6s ease'; li.style.opacity=1; li.style.transform='translateY(0)'; }, 120 + idx*60);
    });

    estCount.textContent = items.length;
    estWeight.textContent = (totalWeight).toFixed(2) + ' kg';

    resultArea.classList.remove('hidden');
    emptyState.classList.add('hidden');
  }

  // Save / load lists to localStorage
  function saveListObj(obj){
    const existing = JSON.parse(localStorage.getItem('ps_lists') || '[]');
    existing.unshift(obj);
    localStorage.setItem('ps_lists', JSON.stringify(existing.slice(0,20)));
    renderSavedLists();
  }

  function renderSavedLists(){
    const existing = JSON.parse(localStorage.getItem('ps_lists') || '[]');
    savedListsEl.innerHTML = '';
    if(existing.length === 0){
      savedListsEl.innerHTML = '<li class="small">No saved lists yet.</li>';
      return;
    }
    existing.forEach((s, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<div><strong>${s.title}</strong><div class="small">${s.meta}</div></div>
                      <div>
                        <button class="btn" data-load="${idx}">Load</button>
                        <button class="btn" data-delete="${idx}">Del</button>
                      </div>`;
      savedListsEl.appendChild(li);
    });
    // attach handlers
    savedListsEl.querySelectorAll('[data-load]').forEach(btn => btn.onclick = (e) => {
      const idx = Number(e.target.getAttribute('data-load'));
      const existing = JSON.parse(localStorage.getItem('ps_lists') || '[]');
      const item = existing[idx];
      if(item){
        // repopulate form & render
        el('destination').value = item.form.destination;
        el('date-from').value = item.form.from;
        el('date-to').value = item.form.to;
        el('luggage').value = item.form.luggage;
        el('style').value = item.form.style;
        el('notes').value = item.form.notes || '';
        // check activities
        document.querySelectorAll('#pack-form input[type=checkbox]').forEach(cb => cb.checked = item.form.activities.includes(cb.value));
        renderPacking(item.form, item.items);
      }
    });
    savedListsEl.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = (e) => {
      const idx = Number(e.target.getAttribute('data-delete'));
      const existing = JSON.parse(localStorage.getItem('ps_lists') || '[]');
      existing.splice(idx,1);
      localStorage.setItem('ps_lists', JSON.stringify(existing));
      renderSavedLists();
    });
  }

  // copy to clipboard share link (simple JSON encoded in clipboard as URL)
  function copyShare(items, form){
    const payload = { form, items };
    const blob = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const fakeUrl = `${location.origin}${location.pathname}#ps=${blob}`;
    navigator.clipboard.writeText(fakeUrl).then(()=> {
      alert('Share link copied to clipboard (paste in a new tab to load).');
    }).catch(()=> alert('Copy failed. You can still save the list and share JSON manually.'));
  }

  // on load, check if hash contains a list share
  function checkHashShare(){
    if(location.hash.startsWith('#ps=')){
      try{
        const encoded = location.hash.slice(4);
        const json = decodeURIComponent(escape(atob(encoded)));
        const payload = JSON.parse(json);
        if(payload && payload.form && payload.items){
          renderPacking(payload.form, payload.items);
          // clear hash to avoid reloading repeatedly
        }
      }catch(e){ console.warn('invalid share hash'); }
    }
  }

  // event hookups
  generateBtn.addEventListener('click', () => {
    // collect form data
    const destination = el('destination').value.trim();
    const from = el('date-from').value;
    const to = el('date-to').value;
    const notes = el('notes').value.trim();
    const luggage = el('luggage').value;
    const style = el('style').value;
    const activities = Array.from(document.querySelectorAll('#pack-form input[type=checkbox]:checked')).map(i=>i.value);

    if(!destination || !from || !to){
      alert('Please fill destination and dates.');
      return;
    }
    // show thinking
    showThinking(true);

    // simulate processing time with animation
    setTimeout(()=> {
      const formObj = { destination, from, to, notes, luggage, style, activities };
      const items = generatePacking(formObj);
      // fake weather adaptation: if destination word contains "beach" or "isle" add sunhat
      if(/beach|isle|cove|coast|bahamas|miami/i.test(destination) && !items.some(i=>i.key==='swim')) {
        items.push({ key:'swim', label: 'Swimwear', weight:0.12 });
      }

      renderPacking(formObj, items);
      showThinking(false);
    }, 900 + Math.random()*700);
  });

  saveListBtn.addEventListener('click', () => {
    // save current list
    const title = listTitle.textContent;
    const formFields = {
      destination: el('destination').value,
      from: el('date-from').value,
      to: el('date-to').value,
      luggage: el('luggage').value,
      style: el('style').value,
      activities: Array.from(document.querySelectorAll('#pack-form input[type=checkbox]:checked')).map(i=>i.value),
      notes: el('notes').value
    };
    const items = Array.from(packingListEl.querySelectorAll('li')).map(li => {
      return {
        label: li.querySelector('strong') ? li.querySelector('strong').innerText : li.innerText,
        weight: parseFloat(li.querySelector('.badge')?.innerText || '0') || 0
      };
    });

    const obj = {
      id: Date.now(),
      title,
      meta: `${formFields.destination} · ${formFields.from}→${formFields.to}`,
      form: formFields,
      items
    };
    saveListObj(obj);
    alert('List saved locally.');
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });

  copyBtn.addEventListener('click', () => {
    // read current list and copy a share URL
    const formFields = {
      destination: el('destination').value,
      from: el('date-from').value,
      to: el('date-to').value,
      luggage: el('luggage').value,
      style: el('style').value,
      activities: Array.from(document.querySelectorAll('#pack-form input[type=checkbox]:checked')).map(i=>i.value),
      notes: el('notes').value
    };
    const items = Array.from(packingListEl.querySelectorAll('li')).map(li => {
      return {
        label: li.querySelector('strong') ? li.querySelector('strong').innerText : li.innerText,
        weight: parseFloat(li.querySelector('.badge')?.innerText || '0') || 0
      };
    });
    copyShare(items, formFields);
  });

  // initial render
  renderSavedLists();
  checkHashShare();

  // small neat interaction: when the form resets, show empty state
  document.getElementById('clear').addEventListener('click', () => {
    resultArea.classList.add('hidden');
    emptyState.classList.remove('hidden');
  });

})();
