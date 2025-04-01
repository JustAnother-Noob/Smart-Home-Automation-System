// src/pages/HomePage.jsx
export default function HomePage() {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Transform Your Home with Smart Living
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Discover our innovative home automation solutions for a smarter, safer, and more efficient lifestyle.
          </p>
          
          {/* Featured Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {['Security Cameras', 'Thermostats', 'Smart Lighting', 'Automation Kits'].map((category) => (
              <div key={category} className="p-6 border rounded-lg hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{category}</h3>
                <p className="text-gray-600">Explore our {category.toLowerCase()} collection</p>
              </div>
            ))}
          </div>
        </section>
  
        {/* Featured Products Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">Featured Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Product cards would go here */}
          </div>
        </section>
      </div>
    );
  }