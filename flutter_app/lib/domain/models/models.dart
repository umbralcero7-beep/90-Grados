// ==============================================================================
// Modelos de Dominio - 90 Grados POS Flutter
// Restaurante-Bar 90 Grados, Cundinamarca, Colombia
// ==============================================================================

enum UserRole {
  administrador,
  cajero,
  mesero,
  cocinaBar,
  inventarioContabilidad,
}

enum Station {
  cocina,
  bar,
}

enum OrderStationStatus {
  recibido,
  enPreparacion,
  listo,
  entregado,
}

class UserProfile {
  final String id;
  final String username;
  final String fullName;
  final UserRole role;
  final String bio;
  final String avatarUrl;
  final String pin;
  final String phone;
  final String assignedShift;

  const UserProfile({
    required this.id,
    required this.username,
    required this.fullName,
    required this.role,
    required this.bio,
    required this.avatarUrl,
    required this.pin,
    required this.phone,
    required this.assignedShift,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] ?? '',
      username: json['username'] ?? '',
      fullName: json['fullName'] ?? '',
      role: UserRole.values.firstWhere(
        (e) => e.name == json['role'], 
        orElse: () => UserRole.mesero
      ),
      bio: json['bio'] ?? '',
      avatarUrl: json['avatarUrl'] ?? '',
      pin: json['pin'] ?? '',
      phone: json['phone'] ?? '',
      assignedShift: json['assignedShift'] ?? 'matutino',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'fullName': fullName,
    'role': role.name,
    'bio': bio,
    'avatarUrl': avatarUrl,
    'pin': pin,
    'phone': phone,
    'assignedShift': assignedShift,
  };
}

class Product {
  final String id;
  final String sku;
  final String name;
  final String category;
  final int priceCOP; // Entero en COP
  final Station station;
  final String unit;
  final String? description;
  final bool isAvailable;
  final String allowedShifts;

  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.category,
    required this.priceCOP,
    required this.station,
    required this.unit,
    this.description,
    this.isAvailable = true,
    this.allowedShifts = 'todos',
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] ?? '',
      sku: json['sku'] ?? '',
      name: json['name'] ?? '',
      category: json['category'] ?? '',
      priceCOP: (json['priceCOP'] as num?)?.toInt() ?? 0,
      station: json['station'] == 'bar' ? Station.bar : Station.cocina,
      unit: json['unit'] ?? 'unidad',
      description: json['description'],
      isAvailable: json['isAvailable'] ?? true,
      allowedShifts: json['allowedShifts'] ?? 'todos',
    );
  }
}

class OrderItem {
  final String productId;
  final String productName;
  final int unitPriceCOP;
  int quantity;
  final Station station;
  String? notes;

  OrderItem({
    required this.productId,
    required this.productName,
    required this.unitPriceCOP,
    required this.quantity,
    required this.station,
    this.notes,
  });

  int get subtotal => unitPriceCOP * quantity;
}

class Order {
  final String id;
  final int orderNumber;
  final String tableNumber;
  final String waiterUsername;
  final List<OrderItem> items;
  final DateTime createdAt;
  String status; // 'abierta', 'en_pago', 'pagada', 'cancelada'
  OrderStationStatus cocinaStatus;
  OrderStationStatus barStatus;
  String? customerNote;

  Order({
    required this.id,
    required this.orderNumber,
    required this.tableNumber,
    required this.waiterUsername,
    required this.items,
    required this.createdAt,
    this.status = 'abierta',
    this.cocinaStatus = OrderStationStatus.recibido,
    this.barStatus = OrderStationStatus.recibido,
    this.customerNote,
  });

  int get totalAmountCOP => items.fold(0, (sum, i) => sum + i.subtotal);
}
