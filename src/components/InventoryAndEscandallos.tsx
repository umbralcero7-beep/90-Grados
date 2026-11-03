import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product, InventoryItem, Recipe, ProductCategory, Station } from '../types';
import { formatCOP } from '../utils/format';
import { 
  Package, 
  Layers, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Plus, 
  Check, 
  AlertCircle, 
  ArrowUpDown, 
  ChefHat, 
  Flame, 
  Percent, 
  Search,
  Filter,
  X
} from 'lucide-react';

export const InventoryAndEscandallos: React.FC = () => {
  const { 
    products, 
    addProduct, 
    updateProduct, 
    bulkAddProducts, 
    inventory, 
    updateInventoryItem, 
    recipes, 
    currentUser,
    hasPermission 
  } = useApp();

  const canManageInventory = hasPermission('gestionar_inventario');

  const [activeTab, setActiveTab] = useState<'carta' | 'insumos' | 'escandallos' | 'movimientos'>('carta');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [availabilityFilter, setAvailabilityFilter] = useState<'todos' | 'disponible' | 'agotado'>('todos');

  // New Product Modal State
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<ProductCategory>('Carnes');
  const [newProdPrice, setNewProdPrice] = useState<number>(35000);
  const [newProdStation, setNewProdStation] = useState<Station>('cocina');
  const [newProdUnit, setNewProdUnit] = useState('plato');
  const [newProdDesc, setNewProdDesc] = useState('');

  // Mass CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Sample CSV Template for Carta
  const sampleCSV = `SKU,Nombre,Categoria,PrecioCOP,Estacion,Unidad,Descripcion
CR-020,Choriperro Especial,Comidas Rápidas,22000,cocina,unidad,Chorizo artesanal con queso derretido y papas ripio
BEB-015,Limonada de Coco,Jugos Naturales,14000,bar,vaso,Limonada frappe con leche de coco artesanal
CAR-015,Punta de Anca 350g,Carnes,48000,cocina,plato,Corte tierno a la brasa con papas francesas y chimichurri`;

  const downloadCSVTemplate = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_productos_90grados.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseCSV = (content: string) => {
    setCsvRawText(content);
    setImportErrors([]);
    setImportPreview([]);

    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      setImportErrors(['El archivo no contiene suficientes filas. Mínimo encabezado y 1 fila de datos.']);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const previewRows: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(c => c.trim());
      if (row.length < 5) continue;

      const [sku, name, category, priceStr, station, unit, desc] = row;
      const price = parseInt(priceStr, 10);

      if (!name) errors.push(`Fila ${i + 1}: El nombre del producto es obligatorio.`);
      if (isNaN(price) || price < 0) errors.push(`Fila ${i + 1}: El precio (${priceStr}) no es válido.`);

      previewRows.push({
        sku: sku || `SKU-${Date.now()}-${i}`,
        name,
        category: category as ProductCategory || 'Carnes',
        price: isNaN(price) ? 0 : price,
        station: station === 'bar' ? 'bar' : 'cocina',
        unit: unit || 'unidad',
        description: desc || '',
        available: true,
        allowedShifts: 'todos',
      });
    }

    setImportPreview(previewRows);
    setImportErrors(errors);
  };

  const handleConfirmImport = () => {
    if (importPreview.length === 0 || importErrors.length > 0) return;

    bulkAddProducts(importPreview);
    setImportSuccessMsg(`¡${importPreview.length} productos importados exitosamente!`);
    setTimeout(() => {
      setImportSuccessMsg('');
      setShowImportModal(false);
      setImportPreview([]);
      setCsvRawText('');
    }, 1500);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    addProduct({
      sku: `PROD-${Date.now().toString().slice(-4)}`,
      name: newProdName.trim(),
      category: newProdCategory,
      price: Number(newProdPrice) || 0,
      station: newProdStation,
      available: true,
      unit: newProdUnit,
      description: newProdDesc.trim(),
      allowedShifts: 'todos',
    });

    setShowNewProductModal(false);
    setNewProdName('');
    setNewProdDesc('');
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0D18] text-[#EBE1D5] overflow-y-auto">
      
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[#EBE1D5]/20 header-brand-gradient flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#151946] border border-[#EBE1D5]/20 flex items-center justify-center text-[#EBE1D5]">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Inventario, Cargas Masivas & Escandallos</h2>
            <p className="text-xs text-[#A6AFCA]">
              Gestión operativa de recetas, materias primas y carta · Responsable: <strong className="text-[#EBE1D5] font-mono">@{currentUser.username}</strong>
            </p>
          </div>
        </div>

        {/* 4 Mandatory Subtabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-xl text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('carta')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === 'carta' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
            }`}
          >
            1. Carta / Productos ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('insumos')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === 'insumos' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
            }`}
          >
            2. Insumos ({inventory.length})
          </button>
          <button
            onClick={() => setActiveTab('escandallos')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === 'escandallos' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
            }`}
          >
            3. Recetas / Escandallos
          </button>
          <button
            onClick={() => setActiveTab('movimientos')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === 'movimientos' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
            }`}
          >
            4. Movimientos & Conteos
          </button>
        </div>
      </div>
      {/* Role permission alert banner */}
      {!canManageInventory && (
        <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-[#7C170D]/20 border border-[#7C170D]/50 rounded-xl text-xs text-[#EBE1D5] flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#EBE1D5] shrink-0" />
            <span>
              <strong>Modo Solo Lectura:</strong> Tu rol (@{currentUser.username} - <em className="capitalize">{currentUser.role}</em>) no tiene activo el permiso <span className="font-mono text-white font-bold">gestionar_inventario</span>. Las operaciones de modificación y creación están restringidas.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0E1120] border border-[#EBE1D5]/20 text-[#A6AFCA] shrink-0">
            Solo Consulta
          </span>
        </div>
      )}

      {/* SUBTAB 1: CARTA / PRODUCTOS */}
      {activeTab === 'carta' && (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-4">
          
          {/* Action and Filter toolbar */}
          <div className="p-3.5 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md">
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              {/* Prominent Search bar */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-[#A6AFCA] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar plato, bebida, ingrediente o SKU..."
                  className="w-full pl-9 pr-8 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A6AFCA] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl text-xs text-[#EBE1D5] focus:outline-none focus:border-[#7C170D] cursor-pointer"
              >
                <option value="todas">Todas las categorías ({products.length})</option>
                {Array.from(new Set(products.map(p => p.category))).map(cat => (
                  <option key={cat} value={cat}>
                    {cat} ({products.filter(p => p.category === cat).length})
                  </option>
                ))}
              </select>

              {/* Availability Filter */}
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                className="px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl text-xs text-[#EBE1D5] focus:outline-none focus:border-[#7C170D] cursor-pointer"
              >
                <option value="todos">Disponibilidad: Todos</option>
                <option value="disponible">Solo Disponibles ({products.filter(p => p.available).length})</option>
                <option value="agotado">Solo Agotados ({products.filter(p => !p.available).length})</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={downloadCSVTemplate}
                className="px-3 py-2 rounded-xl bg-[#151946] hover:bg-[#151946]/80 border border-[#EBE1D5]/20 text-[#EBE1D5] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Descargar plantilla Excel / CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#EBE1D5]" />
                <span className="hidden sm:inline">Plantilla</span>
              </button>
              <button
                onClick={() => {
                  if (!canManageInventory) {
                    alert('Acceso Restringido: Tu rol no cuenta con el permiso "gestionar_inventario". Solicita autorización al administrador en Configuración.');
                    return;
                  }
                  setShowImportModal(true);
                }}
                disabled={!canManageInventory}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  canManageInventory 
                    ? 'bg-[#151946] hover:bg-[#151946]/80 border-[#EBE1D5]/20 text-[#EBE1D5] hover:text-white cursor-pointer' 
                    : 'bg-[#151946]/30 text-[#A6AFCA] border-[#EBE1D5]/10 cursor-not-allowed opacity-60'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[#EBE1D5]" />
                <span>Importar CSV</span>
              </button>
              <button
                onClick={() => {
                  if (!canManageInventory) {
                    alert('Acceso Restringido: Tu rol no cuenta con el permiso "gestionar_inventario". Solicita autorización al administrador en Configuración.');
                    return;
                  }
                  setShowNewProductModal(true);
                }}
                disabled={!canManageInventory}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md border ${
                  canManageInventory
                    ? 'bg-[#7C170D] hover:bg-[#961D12] text-white border-[#EBE1D5]/30 cursor-pointer'
                    : 'bg-[#151946]/30 text-[#A6AFCA] border-[#EBE1D5]/10 cursor-not-allowed opacity-60'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Producto</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-[#EBE1D5]/20 bg-[#0E1120] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Estación</th>
                    <th className="p-3 text-right">Precio Venta (COP)</th>
                    <th className="p-3 text-right">Costo Est.</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBE1D5]/10">
                  {products
                    .filter(p => {
                      const query = searchFilter.toLowerCase().trim();
                      const matchesSearch = !query || 
                        p.name.toLowerCase().includes(query) || 
                        p.sku.toLowerCase().includes(query) ||
                        p.category.toLowerCase().includes(query) ||
                        (p.description && p.description.toLowerCase().includes(query));
                      const matchesCategory = categoryFilter === 'todas' || p.category === categoryFilter;
                      const matchesAvailability = availabilityFilter === 'todos' || 
                        (availabilityFilter === 'disponible' && p.available) || 
                        (availabilityFilter === 'agotado' && !p.available);
                      return matchesSearch && matchesCategory && matchesAvailability;
                    })
                    .map((prod) => (
                      <tr key={prod.id} className="hover:bg-[#151946]/20 transition-colors">
                        <td className="p-3 font-mono text-[#A6AFCA]">{prod.sku}</td>
                        <td className="p-3 font-semibold text-white">{prod.name}</td>
                        <td className="p-3 text-[#A6AFCA]">{prod.category}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            prod.station === 'cocina' ? 'bg-[#7C170D]/30 text-orange-200 border border-[#7C170D]/50' : 'bg-[#151946] text-[#EBE1D5] border border-[#EBE1D5]/20'
                          }`}>
                            {prod.station}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#EBE1D5] tabular-nums">
                          {formatCOP(prod.price)}
                        </td>
                        <td className="p-3 text-right font-mono text-[#A6AFCA] tabular-nums">
                          {prod.estimatedCost ? formatCOP(prod.estimatedCost) : 'N/A'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              if (!canManageInventory) {
                                alert('Acceso Restringido: Tu rol no cuenta con el permiso "gestionar_inventario". Solicita autorización al administrador en Configuración.');
                                return;
                              }
                              updateProduct(prod.id, { available: !prod.available });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              prod.available 
                                ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60' 
                                : 'bg-[#7C170D]/40 text-red-200 border border-[#7C170D]/60 hover:bg-[#7C170D]/70'
                            }`}
                          >
                            {prod.available ? 'Disponible' : 'Agotado'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SUBTAB 2: INSUMOS */}
      {activeTab === 'insumos' && (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-4">
          <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Inventario de Ingredientes e Insumos</h3>
              <p className="text-xs text-[#A6AFCA]">
                Control con unidad de compra (ej. Bulto x 50kg) y unidad de receta (ej. Gramo).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#EBE1D5]/20 bg-[#0E1120] overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold">
                  <tr>
                    <th className="p-3">Insumo</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Ubicación</th>
                    <th className="p-3">Unidad Compra / Receta</th>
                    <th className="p-3 text-right">Existencia Actual</th>
                    <th className="p-3 text-right">Costo Unit.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBE1D5]/10 font-mono">
                  {inventory.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#151946]/20">
                      <td className="p-3 font-sans font-semibold text-white">{inv.name}</td>
                      <td className="p-3 font-sans text-[#A6AFCA]">{inv.category}</td>
                      <td className="p-3 font-sans text-[#EBE1D5]">{inv.location}</td>
                      <td className="p-3 text-[#A6AFCA]">
                        {inv.purchaseUnit} → 1 = {inv.conversionRatio} {inv.recipeUnit}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">
                        {inv.currentStock.toLocaleString('es-CO')} {inv.recipeUnit}
                      </td>
                      <td className="p-3 text-right text-[#EBE1D5] tabular-nums">
                        {formatCOP(inv.unitCostCOP)} / {inv.recipeUnit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: RECETAS / ESCANDALLOS */}
      {activeTab === 'escandallos' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
          <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#EBE1D5]" />
              Escandallos y Costeo Teórico de Ventas
            </h3>
            <p className="text-xs text-[#A6AFCA] mt-1">
              Desglose de receta, porcentaje de merma, costo teórico por porción y margen bruto sobre el precio de venta en COP.
            </p>
          </div>

          {recipes.map(rec => (
            <div key={rec.id} className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBE1D5]/15 pb-3">
                <div>
                  <h4 className="text-lg font-bold text-white">{rec.productName}</h4>
                  <span className="text-xs text-[#A6AFCA]">
                    Rendimiento: {rec.servings} porción · Merma estimada: {rec.wastePercentage}%
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-[#A6AFCA] block">Costo Teórico:</span>
                    <strong className="text-white text-sm">{formatCOP(rec.theoreticalCostCOP)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#A6AFCA] block">Precio Carta:</span>
                    <strong className="text-[#EBE1D5] text-sm">{formatCOP(rec.salePriceCOP)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#A6AFCA] block">Margen Bruto:</span>
                    <strong className="text-emerald-400 text-sm">{rec.theoreticalMarginPercentage}%</strong>
                  </div>
                </div>
              </div>

              {/* Ingredients list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-[#A6AFCA] border-b border-[#EBE1D5]/15">
                    <tr>
                      <th className="pb-2">Ingrediente</th>
                      <th className="pb-2 text-right">Cantidad</th>
                      <th className="pb-2 text-right">Costo Unitario</th>
                      <th className="pb-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBE1D5]/10 text-[#EBE1D5]">
                    {rec.ingredients.map((ing, i) => (
                      <tr key={i} className="py-1.5">
                        <td className="py-2 font-sans font-medium text-white">{ing.ingredientName}</td>
                        <td className="py-2 text-right">{ing.quantityInRecipeUnit} gr/un</td>
                        <td className="py-2 text-right">{formatCOP(ing.unitCost)}</td>
                        <td className="py-2 text-right font-bold text-[#EBE1D5]">{formatCOP(ing.subtotalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUBTAB 4: MOVIMIENTOS & CONTEOS */}
      {activeTab === 'movimientos' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-4">
          <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Movimientos Trazables de Inventario</h3>
              <p className="text-xs text-[#A6AFCA]">Entradas por compra, mermas autorizadas y traslados entre bodegas.</p>
            </div>
            <button
              onClick={() => alert('Para registrar una compra con impacto en caja y libro mayor, use el módulo de Gastos y Libro Mayor.')}
              className="px-3 py-1.5 rounded-lg bg-[#151946] hover:bg-[#7C170D] border border-[#EBE1D5]/20 text-xs text-[#EBE1D5] hover:text-white font-semibold cursor-pointer transition-colors"
            >
              + Registrar Movimiento
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 text-xs text-[#A6AFCA]">
            Los consumos se descuentan automáticamente a partir de las comandas cerradas de Restaurante y Bar. No se permite stock negativo sin confirmación de supervisor.
          </div>
        </div>
      )}

      {/* NEW PRODUCT MODAL */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121524] border border-[#EBE1D5]/20 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Agregar Producto a la Carta</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#EBE1D5] mb-1">Nombre del Plato / Bebida *</label>
                <input
                  type="text"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#7C170D]"
                  placeholder="ej. Picada Especial 90°"
                  required
                />
              </div>

              <div>
                <label className="block text-[#EBE1D5] mb-1">Categoría *</label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                >
                  <option value="Comidas Rápidas">Comidas Rápidas</option>
                  <option value="Picadas">Picadas</option>
                  <option value="Carnes">Carnes</option>
                  <option value="Platos en Salsa">Platos en Salsa</option>
                  <option value="Pescados">Pescados</option>
                  <option value="Aves">Aves</option>
                  <option value="Desayunos">Desayunos</option>
                  <option value="Jugos Naturales">Jugos Naturales</option>
                  <option value="Cervezas">Cervezas</option>
                  <option value="Licores">Licores</option>
                  <option value="Bebidas Frías">Bebidas Frías</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#EBE1D5] mb-1">Precio COP *</label>
                  <input
                    type="number"
                    step="500"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono focus:outline-none focus:border-[#7C170D]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#EBE1D5] mb-1">Estación KDS *</label>
                  <select
                    value={newProdStation}
                    onChange={(e) => setNewProdStation(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="cocina">Cocina</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#EBE1D5] mb-1">Descripción / Ingredientes</label>
                <textarea
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
                  placeholder="Acompañamientos y presentación..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EBE1D5]/15">
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(false)}
                  className="px-4 py-2 text-[#A6AFCA] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7C170D] hover:bg-[#961D12] text-white font-bold rounded-lg cursor-pointer border border-[#EBE1D5]/30 shadow-md transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MASS IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#121524] border border-[#EBE1D5]/20 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#EBE1D5]" />
              Importación Masiva de Productos (CSV)
            </h3>
            <p className="text-xs text-[#A6AFCA]">
              Pega aquí el contenido de tu archivo CSV o escribe las líneas siguiendo el formato requerido:
            </p>

            <textarea
              value={csvRawText}
              onChange={(e) => handleParseCSV(e.target.value)}
              placeholder="SKU,Nombre,Categoria,PrecioCOP,Estacion,Unidad,Descripcion&#10;CR-020,Choriperro,Comidas Rápidas,22000,cocina,unidad,Chorizo artesanal"
              rows={5}
              className="w-full p-3 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl font-mono text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
            />

            {importErrors.length > 0 && (
              <div className="p-3 bg-[#7C170D]/20 border border-[#7C170D]/50 rounded-lg text-xs text-red-300 space-y-1">
                {importErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {importPreview.length > 0 && importErrors.length === 0 && (
              <div className="space-y-2">
                <span className="text-xs text-[#EBE1D5] font-bold">
                  Vista Previa ({importPreview.length} filas listas para importar):
                </span>
                <div className="max-h-40 overflow-y-auto border border-[#EBE1D5]/20 rounded-lg p-2 bg-[#0B0D18] space-y-1 text-xs">
                  {importPreview.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[#EBE1D5] py-0.5 border-b border-[#EBE1D5]/10">
                      <span><strong>{item.name}</strong> ({item.category})</span>
                      <span className="font-mono text-white font-bold">{formatCOP(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importSuccessMsg && (
              <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> {importSuccessMsg}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EBE1D5]/15">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs text-[#A6AFCA] hover:text-white"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={importPreview.length === 0 || importErrors.length > 0}
                onClick={handleConfirmImport}
                className="px-5 py-2 text-xs font-bold bg-[#7C170D] hover:bg-[#961D12] text-white rounded-lg cursor-pointer disabled:opacity-50 border border-[#EBE1D5]/30 shadow-md transition-colors"
              >
                Confirmar e Importar Lote
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
