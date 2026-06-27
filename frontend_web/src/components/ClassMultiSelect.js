// frontend_web/src/components/ClassMultiSelect.js
// Komponen Multi-select Checkbox kelas yang dikelompokkan per Angkatan/Tingkat.
// Dipakai di form pembuatan / edit ujian (Admin & Guru).
//
// Usage:
//   const picker = new ClassMultiSelect(containerEl, { selected: [1,3,5] });
//   picker.getSelected()   → [1, 3, 5]   (array of class IDs)
//   picker.setSelected([2, 4])
//   picker.destroy()

import { createElement } from '../utils/dom.js';
import { api } from '../services/api.js';

export class ClassMultiSelect {
  /**
   * @param {HTMLElement} container - elemen yang akan diisi komponen
   * @param {Object}      opts
   * @param {number[]}    opts.selected - class IDs yang sudah terpilih (untuk edit)
   * @param {Function}    opts.onChange - callback(selectedIds: number[])
   */
  constructor(container, opts = {}) {
    this.container  = container;
    this.selected   = new Set(opts.selected ?? []);
    this.onChange   = opts.onChange ?? (() => {});
    this._root      = null;
    this._init();
  }

  async _init() {
    this._root = createElement('div', 'space-y-sm');
    this._root.innerHTML = `
      <div class="flex items-center gap-sm text-text-secondary py-sm">
        <span class="material-icons text-sm animate-spin">progress_activity</span>
        <span class="font-inter text-sm">Memuat daftar kelas...</span>
      </div>`;
    this.container.appendChild(this._root);

    try {
      const res = await api.get('/admin/classes/grades');
      const grades = res.data?.data ?? [];   // [{ id, name, label, classes: [...] }]
      this._render(grades);
    } catch {
      this._root.innerHTML = `<p class="text-primary text-sm font-inter">Gagal memuat kelas.</p>`;
    }
  }

  _render(grades) {
    this._root.innerHTML = '';

    if (!grades.length) {
      this._root.innerHTML = `
        <p class="text-text-muted text-sm font-inter italic">
          Belum ada kelas. Buat kelas terlebih dahulu di tab Kelas.
        </p>`;
      return;
    }

    // Label header
    const header = createElement('div', 'flex items-center justify-between mb-xs');
    header.innerHTML = `
      <span class="font-inter font-bold text-input-label text-text-primary uppercase tracking-label">
        Kelas Peserta Ujian
      </span>
      <button type="button" id="cls-clear-all"
        class="text-xs text-text-muted hover:text-primary font-inter underline">
        Hapus Semua
      </button>`;
    this._root.appendChild(header);
    header.querySelector('#cls-clear-all').addEventListener('click', () => this._clearAll());

    // Summary pill
    this._summaryEl = createElement('div', 'mb-sm');
    this._root.appendChild(this._summaryEl);
    this._updateSummary();

    // Grouped per grade
    grades.forEach(grade => {
      if (!grade.classes?.length) return;

      const section = createElement('div', 'mb-md');

      // Grade header row + "pilih semua" toggle
      const gradeHeader = createElement('div',
        'flex items-center justify-between px-sm py-xs bg-bg-primary rounded-btn mb-xs');
      gradeHeader.innerHTML = `
        <span class="font-inter font-bold text-sm text-accent-gold uppercase tracking-label">
          ${grade.label}
        </span>
        <button type="button" data-grade="${grade.id}"
          class="grade-toggle text-xs text-text-muted hover:text-online font-inter underline">
          Pilih Semua
        </button>`;
      section.appendChild(gradeHeader);

      // Checkbox grid
      const grid = createElement('div', 'grid grid-cols-2 gap-xs');
      grade.classes.forEach(cls => {
        const checked = this.selected.has(cls.id);
        const label   = createElement('label',
          'flex items-center gap-xs px-sm py-xs rounded-btn cursor-pointer hover:bg-bg-surface-light transition-colors select-none');
        label.innerHTML = `
          <input type="checkbox" value="${cls.id}" ${checked ? 'checked' : ''}
            class="class-cb w-4 h-4 accent-online rounded cursor-pointer"
            data-grade="${grade.id}">
          <span class="font-inter text-sm text-text-primary">${cls.name}</span>
          ${cls.major ? `<span class="text-xs text-text-muted">(${cls.major})</span>` : ''}`;
        label.querySelector('input').addEventListener('change', e => {
          const id = +e.target.value;
          e.target.checked ? this.selected.add(id) : this.selected.delete(id);
          this._updateGradeToggle(gradeHeader.querySelector('button'), grade, grid);
          this._updateSummary();
          this.onChange(this.getSelected());
        });
        grid.appendChild(label);
      });

      section.appendChild(grid);
      this._root.appendChild(section);

      // Grade toggle button
      this._updateGradeToggle(gradeHeader.querySelector('button'), grade, grid);
      gradeHeader.querySelector('.grade-toggle').addEventListener('click', e => {
        this._toggleGrade(e.target, grade, grid);
      });
    });
  }

  _toggleGrade(btn, grade, grid) {
    const checkboxes = grid.querySelectorAll('.class-cb');
    const allChecked = [...checkboxes].every(cb => cb.checked);
    checkboxes.forEach(cb => {
      const id = +cb.value;
      if (allChecked) { cb.checked = false; this.selected.delete(id); }
      else            { cb.checked = true;  this.selected.add(id); }
    });
    this._updateGradeToggle(btn, grade, grid);
    this._updateSummary();
    this.onChange(this.getSelected());
  }

  _updateGradeToggle(btn, grade, grid) {
    const checkboxes = [...grid.querySelectorAll('.class-cb')];
    const allChecked  = checkboxes.every(cb => cb.checked);
    btn.textContent   = allChecked ? 'Hapus Semua' : 'Pilih Semua';
    btn.className     = `grade-toggle text-xs font-inter underline ${allChecked ? 'text-primary hover:text-text-muted' : 'text-text-muted hover:text-online'}`;
  }

  _clearAll() {
    this.selected.clear();
    this._root.querySelectorAll('.class-cb').forEach(cb => cb.checked = false);
    this._root.querySelectorAll('.grade-toggle').forEach(btn => btn.textContent = 'Pilih Semua');
    this._updateSummary();
    this.onChange([]);
  }

  _updateSummary() {
    if (!this._summaryEl) return;
    const count = this.selected.size;
    this._summaryEl.innerHTML = count
      ? `<span class="inline-flex items-center gap-xs px-sm py-xs bg-online bg-opacity-10 rounded-badge text-online text-xs font-inter font-bold">
           <span class="material-icons text-xs">check_circle</span>
           ${count} kelas dipilih
         </span>`
      : `<span class="text-xs text-text-muted font-inter italic">Belum ada kelas dipilih</span>`;
  }

  /** @returns {number[]} array of selected class IDs */
  getSelected() {
    return [...this.selected];
  }

  /** @param {number[]} ids */
  setSelected(ids) {
    this.selected = new Set(ids);
    this._root.querySelectorAll('.class-cb').forEach(cb => {
      cb.checked = this.selected.has(+cb.value);
    });
    this._updateSummary();
  }

  destroy() {
    this._root?.remove();
  }
}